#!/usr/bin/env python3
"""Otimiza uma foto (lado maior 1600 px, JPG progressivo) e salva em apps/mobile/assets/photos.
Uso: python3 scripts/add-photo.py <origem> <nome-final.jpg>"""
import sys
from PIL import Image, ImageOps
src, name = sys.argv[1:3]
im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
im.thumbnail((1600, 1600), Image.LANCZOS)
out = f'apps/mobile/assets/photos/{name}'
im.save(out, 'JPEG', quality=78, optimize=True, progressive=True)
import os
print(name, im.size, os.path.getsize(out) // 1024, 'KB')
