---
title: 使用rEFInd引导老旧主板上的M2固态硬盘
date: 2023-09-06 00:08:57
tags:
---
比较老的主板虽然可以通过PCIE转M2来使用M2固态硬盘，但是没办法直接从转接后的M2固态硬盘来启动。这时候需要通过装在U盘的引导器来间接启动位于M2硬盘上的系统，一般情况下使用Clover就可以了，很多装黑苹果的都用Clover。

但是，我要启动的是FreeBSD，经过我各种折腾后没能用Clover启动FreeBSD。无奈之下找到了[rEFInd](https://www.rodsbooks.com/refind/)，不过这里有一个问题是，rEFInd也不是直接能支持从M2启动，需要装一个nvme的efi驱动，所以就需要从Clover里找驱动来给rEFInd用。

听起来有点复杂，但实际操作只要以下三步：

1、下载rEFInd的iso镜像，写入U盘。注意写入的时候最好不要用EFI引导模式，在我的主板上EFI的兼容性不太好。

2、下载Clover，解压ZIP后，把**EFI\\CLOVER\\drivers\\off\\UEFI\\Other**目录下的**NvmExpressDxe.efi**放到启动U盘的**EFI\\boot\\drivers_x64**目录。

3、在启动U盘的**EFI\\boot**目录下新建**refind.conf**，内容如下
```
timeout 3
textonly
use_nvram off
```
 这样可以加快启动速度。

这样就可以使用rEFInd来引导安装在M2硬盘上的FreeBSD了。核心步骤就是要从Clover提取**NvmExpressDxe.efi**。

参考：
https://nanaya.net/blog/posts/4691/