"""Depth maps for the artwork that the 3D background turns into scenes.

Each picture listed in `showcase` (in _src/data.cjs) can have a depth map: a small grey image
where white is near and black is far. js/artscene.js uses it to give the flat picture relief, so
it moves like a 3D scene under the pointer. A picture without a depth map still works (the site
falls back to "bright is near"), it just looks flatter.

This tool makes those maps with Depth Anything V2. It does not download anything: point it at
weights you already have. On the studio PC they come with ComfyUI's ControlNet preprocessor pack.

    python tools/make-depth.py assets/images/newidk.jpg assets/images/woman_00000.jpg

Options
    --weights PATH   depth_anything_v2_vitl.pth (default: the ComfyUI copy on D:)
    --code PATH      folder that contains the `custom_controlnet_aux` package (default: same pack)
    --size N         long side of the saved map in pixels (default 512)
    --device NAME    cpu (default) or cuda

Output: assets/images/depth/<name>.webp, named like the thumbnails that tools/make-thumbs.cjs makes.
Run it with a Python that has torch, torchvision, opencv and einops (ComfyUI's own Python does).
"""
import argparse
import os
import re
import sys

PACK = r"D:\ComfyUI\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\custom_nodes\comfyui_controlnet_aux"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def slug(path):
    stem = os.path.splitext(os.path.basename(path))[0].lower()
    return re.sub(r"[^a-z0-9]+", "-", stem).strip("-")


def main():
    ap = argparse.ArgumentParser(description="Depth maps for the artwork that the 3D background turns into scenes.")
    ap.add_argument("images", nargs="+")
    ap.add_argument("--weights", default=os.path.join(PACK, "ckpts", "depth-anything", "Depth-Anything-V2-Large", "depth_anything_v2_vitl.pth"))
    ap.add_argument("--code", default=os.path.join(PACK, "src"))
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--device", default="cpu")
    a = ap.parse_args()

    if not os.path.isfile(a.weights):
        sys.exit(f"weights not found: {a.weights}")
    os.environ.setdefault("HF_HUB_OFFLINE", "1")  # never fetch anything
    sys.path.insert(0, a.code)

    import cv2
    import numpy as np
    import torch
    import torch.nn.functional as F
    from custom_controlnet_aux.depth_anything_v2.dpt import DepthAnythingV2

    model = DepthAnythingV2(encoder="vitl", features=256, out_channels=[256, 512, 1024, 1024])
    model.load_state_dict(torch.load(a.weights, map_location="cpu", weights_only=True))
    model = model.eval().to(a.device)

    out_dir = os.path.join(ROOT, "assets", "images", "depth")
    os.makedirs(out_dir, exist_ok=True)

    for path in a.images:
        src = path if os.path.isabs(path) else os.path.join(ROOT, path)
        raw = cv2.imdecode(np.fromfile(src, dtype=np.uint8), cv2.IMREAD_COLOR)
        if raw is None:
            print(f"skip (cannot read): {path}")
            continue
        h, w = raw.shape[:2]
        with torch.no_grad():
            tensor, _ = model.image2tensor(raw, 518)
            depth = model.forward(tensor.to(a.device), 1.0)
            depth = F.interpolate(depth[:, None], (h, w), mode="bilinear", align_corners=True)[0, 0].cpu().numpy()

        # The model returns "nearness". Stretch it to the full range, ignoring the extreme 1% at each end.
        lo, hi = np.percentile(depth, 1), np.percentile(depth, 99)
        depth = np.clip((depth - lo) / max(hi - lo, 1e-6), 0, 1)

        scale = a.size / max(h, w)
        small = cv2.resize(depth, (max(1, round(w * scale)), max(1, round(h * scale))), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), 1.6)  # soft edges tear less when the picture is pushed into relief
        out = os.path.join(out_dir, slug(path) + ".webp")
        ok, buf = cv2.imencode(".webp", (small * 255).round().astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 82])
        if not ok:
            print(f"skip (cannot encode): {path}")
            continue
        buf.tofile(out)
        print(f"{os.path.relpath(out, ROOT)}  {small.shape[1]}x{small.shape[0]}  {len(buf) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
