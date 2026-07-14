# sunbooshi.github.io
GitHub Pages


## 照片处理
```python
# pip install Pillow
import os
import json
from PIL import Image

# a = Image.open('photo/SDIM0989.jpg')
# exif = a._getexif()
# exif
# # 型号 272
# print(exif[272])
# # 曝光时间 ExposureTime 33434
# print(exif[33434])
# # FNumber 33437
# print(exif[33437])
# # iso 34855
# print(exif[34855])
# # 36867 时间
# print(exif[36867])
# # 37386 焦距
# print(exif[37386])
# # 33437 光圈
# print(exif[33437])
# # 快门 iso
# # 42036 镜头
# print(exif[42036])

def resize_1080(f):
    nf = f.split(".")[0] + '-1080.jpg'
    with Image.open(f) as im:
        size = None
        if im.width > im.height:
            size = (1920, int(1920/im.width*im.height))
        else:
            size = (int(1920/im.height*im.width), 1920)
        im.resize(size).save(nf, 'JPEG')


def convert_name(n):
    names = ['G100', 'GX85', 'fp', 'dp0', 'RX100M5']
    for name in names:
        if n.find(name) >= 0:
            return name
    return n

images = []
for jpg in os.listdir('photo'):
    name = 'photo/' + jpg
    if not name.endswith('jpg'):
        continue
    info = {}
    nf = name.split(".")[0] + '-1080.jpg'
    info['file'] = nf
    with Image.open(name) as im:
        exif = im._getexif()
        # print(convert_name(exif[272]), exif[36867])
        info['camera'] = convert_name(exif[272])
        info['date'] = exif[36867].split(' ')[0].replace(':', '-')
        images.append(info)
    # resize_1080(name)

images.sort(key=lambda img: img['date'])
images.reverse()
print(json.dumps(images))
```