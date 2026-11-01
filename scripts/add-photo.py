#!/usr/bin/env python3
"""Otimiza uma foto (resolução original até 2400 px, JPG progressivo) e salva em apps/mobile/assets/photos.
Uso: python3 scripts/add-photo.py <origem> <nome-final.jpg>"""
import sys
from PIL import Image, ImageOps
src, name = sys.argv[1:3]
im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
im.thumbnail((2400, 2400), Image.LANCZOS)  # nunca amplia; mantém a resolução original para não borrar
out = f'apps/mobile/assets/photos/{name}'
im.save(out, 'JPEG', quality=84, optimize=True, progressive=True)
import os
print(name, im.size, os.path.getsize(out) // 1024, 'KB')
