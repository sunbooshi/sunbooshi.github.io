---
title: 在Windows下制作Grub引导U盘
date: 2024-11-26 19:37:50
tags:
---
在某些特殊的情况下，我们可能需要一个引导U盘，用来装一些工具用于修复无法启动的系统，或者引导位于不同硬盘的系统，我制作这个Grub引导U盘是为了用来引导TrueNAS。

我在去年的时候就折腾过一边，文章最早放在博客上，今年6月又发到了公众号里（[使用Grub启动TrueNAS](https://mp.weixin.qq.com/s/F6GTUoyleOqR5vtYMHWTXA)，结果一年多一点我又要折腾一边。在之前的文章里就提到了为啥有这样奇葩的需求，归根到底还是为了省钱不想更新设备，那就只能“折腾”了。

之前虽然把系统装到硬盘上，但是Grub引导程序还是在SD卡，所以，今天就莫名其妙的重启系统，莫名其妙的无法正确引导，经过我各种排查、尝试之后，发现把引导程序装到U盘上就OK了，我如法炮制一样的步骤又验证了SD卡，结果SD卡就是不行，那我只能认为SD卡出了问题。

去年的文章写的有些简略，这次补齐细节，而且完全在Windows下操作，更容易上手，有了这篇文档之后，下次再出现无法引导的问题，大概5分钟就能制作好一个新的引导U盘了。

## **1**下载支持工具

首先是两个工具：

- Grub https://ftp.gnu.org/gnu/grub/
- Refus https://rufus.ie/zh/


> **注意**
> 以上两个软件要配合好版本，比如当前Refus的**4.6**版本，支持Grub **2.12**版本，可以先下载Refus，根据它支持的版本再去下载Grub。

## **2**格式化U盘

![](/images/2024/20241126164948.png)

打开Refus，在设备中选取插入的U盘，然后在引导类型中选“**Grub 2.12**”，其它都使用默认选项，点击开始进行格式化。

## **3**将Grub安装到U盘

> **警告**
> **本操作有风险，请务必仔细阅读，反复确认无误之后再操作！！！**

首先通过如下命令确认U盘的**DeviceID**，

```
wmic diskdrive list brief
```

以我的电脑为例，输出如下所示：

![](/images/2024/73ddcdb607954fe7ea08539dcbe0e7c.png)

可以看到，这里把所有的硬盘、U盘都列举出来了，所以一定要看清楚，确保使用的是U盘。==**如果设备太多，无法区分，可以在U盘插入前执行一次，U盘插入后执行一次，多出来的设备就是要操作的U盘。**==

这里要用到的就是`\\.\PHYSICALDRIVE2`，接下来以==**管理员身份**==打开Windows命令行，进入Grub的目录，执行如下命令：
```
grub-install.exe --force --no-floppy --target=i386-pc  --boot-directory=e:\boot  \\.\PHYSICALDRIVE2
```
其中，`e:\boot`是表示安装到U盘的**boot**目录，注意要改成自己的U盘路径，比如`f:\boot`，一定要根据自己的U盘路径设置。`\\.\PHYSICALDRIVE2`就是上一个命令获取到的U盘DeviceID，务必填写正确。

命令执行成功以后，回到U盘的根目录创建一个**boot**文件夹。

## **4**制作启动菜单

在U盘的`boot\grub`目录下新建一个**grub.cfg**文件，输入如下内容：

```
# 设置默认启动项（从0开始计数）
set default=0

# 设置启动超时时间（单位：秒）
set timeout=10

# 引导TrueNAS
menuentry "TrueNAS Use Search" --class freebsd --class bsd --class os {
    insmod part_gpt
    insmod part_bsd
    insmod zfs
    insmod bsd
    search -s -l boot-pool # With 12.0, the name of the boot pool has changed
    kfreebsd /ROOT/default/@/boot/zfsloader
    kfreebsd_loadenv /ROOT/default/@/boot/device.hints
}

menuentry "TrueNAS Use Chain" --class freebsd --class bsd --class os {
    insmod part_gpt
    insmod part_bsd
    insmod bsd
    insmod zfs
    insmod chain
    echo Chainloading hd5 ...
    set root=(hd5)
    chainloader +1
}
```

这里使用两种方式引导TrueNAS，第一种是采用search命令，会简单一些，直接搜索TrueNAS的启动分区**boot-pool**，第二种是直接通过磁盘引导，这里的hd5需要改成自己的硬盘编号，比如hd1，hd2等等。在Gen8上，光驱位的硬盘就是hd5。

## **5**总结
TrueNAS虽好，ZFS虽好，但在Gen8这样只支持从1号硬盘或者U盘启动的设备上就很尴尬了，好在有Grub可以支持ZFS，让Gen8能够成为极具性价比的NAS设备。当然，如果是新手用户，还是推荐多花钱买成品NAS，就连我这从FreeNAS升级到TrueNAS的老鸟，今天也是差点挠破头！

