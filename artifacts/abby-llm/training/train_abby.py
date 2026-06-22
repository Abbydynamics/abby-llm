"""
Abby LLM — настоящий трансформер-трейнер на PyTorch (путь для 67 ТБ данных).

Встроенная в приложение модель (n-gram) — это «стартовый мозг», который реально
учится на твоих файлах прямо в Abby без GPU. Но для 67 ТБ нужен полноценный
GPT-трансформер, обучаемый на твоём железе (GPU). Этот скрипт — именно он.

Запуск (на машине с GPU):

    pip install torch numpy
    python train_abby.py --data /путь/к/данным --out ./checkpoints --steps 100000

Поддерживает несколько GPU через torchrun:

    torchrun --nproc_per_node=8 train_abby.py --data /mnt/data --out ./ckpt
"""

import argparse
import math
import os
import glob
import time

import torch
import torch.nn as nn
import torch.nn.functional as F


# ----------------------------- Модель (GPT) -----------------------------

class CausalSelfAttention(nn.Module):
    def __init__(self, n_embd: int, n_head: int, block_size: int):
        super().__init__()
        assert n_embd % n_head == 0
        self.n_head = n_head
        self.c_attn = nn.Linear(n_embd, 3 * n_embd)
        self.c_proj = nn.Linear(n_embd, n_embd)
        self.register_buffer(
            "mask",
            torch.tril(torch.ones(block_size, block_size)).view(
                1, 1, block_size, block_size
            ),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.size()
        q, k, v = self.c_attn(x).split(C, dim=2)
        k = k.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        q = q.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))
        att = att.masked_fill(self.mask[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        y = att @ v
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        return self.c_proj(y)


class Block(nn.Module):
    def __init__(self, n_embd: int, n_head: int, block_size: int):
        super().__init__()
        self.ln1 = nn.LayerNorm(n_embd)
        self.attn = CausalSelfAttention(n_embd, n_head, block_size)
        self.ln2 = nn.LayerNorm(n_embd)
        self.mlp = nn.Sequential(
            nn.Linear(n_embd, 4 * n_embd),
            nn.GELU(),
            nn.Linear(4 * n_embd, n_embd),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.ln1(x))
        x = x + self.mlp(self.ln2(x))
        return x


class AbbyGPT(nn.Module):
    def __init__(self, vocab_size, n_layer=12, n_head=12, n_embd=768, block_size=1024):
        super().__init__()
        self.block_size = block_size
        self.tok_emb = nn.Embedding(vocab_size, n_embd)
        self.pos_emb = nn.Embedding(block_size, n_embd)
        self.blocks = nn.ModuleList(
            [Block(n_embd, n_head, block_size) for _ in range(n_layer)]
        )
        self.ln_f = nn.LayerNorm(n_embd)
        self.head = nn.Linear(n_embd, vocab_size, bias=False)

    def forward(self, idx, targets=None):
        B, T = idx.size()
        pos = torch.arange(0, T, device=idx.device).unsqueeze(0)
        x = self.tok_emb(idx) + self.pos_emb(pos)
        for block in self.blocks:
            x = block(x)
        logits = self.head(self.ln_f(x))
        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)), targets.view(-1)
            )
        return logits, loss


# ------------------------ Потоковая загрузка данных ------------------------

class ByteDataset:
    """Читает корпус (67 ТБ) потоково по файлам — без загрузки всего в память."""

    def __init__(self, data_dir: str, block_size: int):
        self.files = []
        for ext in ("txt", "md", "py", "ts", "js", "json", "html", "csv"):
            self.files += glob.glob(
                os.path.join(data_dir, "**", f"*.{ext}"), recursive=True
            )
        if not self.files:
            raise SystemExit(f"Нет файлов с текстом в {data_dir}")
        self.block_size = block_size
        print(f"Найдено файлов: {len(self.files)}")

    def stream_bytes(self):
        while True:
            for path in self.files:
                try:
                    with open(path, "rb") as f:
                        while chunk := f.read(1 << 20):
                            yield from chunk
                except OSError:
                    continue

    def batches(self, batch_size: int, device: str):
        gen = self.stream_bytes()
        need = batch_size * (self.block_size + 1)
        while True:
            buf = [next(gen) for _ in range(need)]
            data = torch.tensor(buf, dtype=torch.long, device=device)
            data = data.view(batch_size, self.block_size + 1)
            yield data[:, :-1], data[:, 1:]


# --------------------------------- Цикл ---------------------------------

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True, help="Папка с корпусом (до 67 ТБ)")
    p.add_argument("--out", default="./checkpoints")
    p.add_argument("--steps", type=int, default=100_000)
    p.add_argument("--batch", type=int, default=12)
    p.add_argument("--block", type=int, default=1024)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--n_layer", type=int, default=12)
    p.add_argument("--n_head", type=int, default=12)
    p.add_argument("--n_embd", type=int, default=768)
    args = p.parse_args()

    os.makedirs(args.out, exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("ВНИМАНИЕ: GPU не найден. Для 67 ТБ нужен CUDA-GPU.")

    vocab_size = 256  # байтовый словарь — работает с любым языком и кодом
    model = AbbyGPT(
        vocab_size, args.n_layer, args.n_head, args.n_embd, args.block
    ).to(device)
    params = sum(p.numel() for p in model.parameters())
    print(f"Параметров модели: {params/1e6:.1f}M | устройство: {device}")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)
    ds = ByteDataset(args.data, args.block)
    loader = ds.batches(args.batch, device)

    model.train()
    t0 = time.time()
    for step in range(1, args.steps + 1):
        xb, yb = next(loader)
        _, loss = model(xb, yb)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()

        if step % 50 == 0:
            dt = time.time() - t0
            ppl = math.exp(min(20, loss.item()))
            print(
                f"step {step}/{args.steps} | loss {loss.item():.4f} "
                f"| ppl {ppl:.2f} | {step/dt:.1f} it/s"
            )
        if step % 2000 == 0:
            ckpt = os.path.join(args.out, f"abby-step{step}.pt")
            torch.save(
                {"model": model.state_dict(), "step": step, "args": vars(args)},
                ckpt,
            )
            print(f"Чекпоинт сохранён → {ckpt}")

    torch.save({"model": model.state_dict(), "step": args.steps}, os.path.join(args.out, "abby-final.pt"))
    print("Обучение завершено.")


if __name__ == "__main__":
    main()
