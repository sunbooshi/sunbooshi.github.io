---
title: 使用Grub启动TrueNAS
date: 2023-10-10 10:55:16
tags:
---

为啥会有这样的需求？

我的硬件是惠普的Gen8，它本身有4个硬盘笼的sata加一个光驱位的sata，光驱位的sata可以用固态硬盘，这样就可以把系统装在光驱位上，就把4个硬盘笼作为数据盘充分使用，做到轻松替换。但奇葩的是的Gen8默认是启动sata1，也就是硬盘笼的第一个硬盘。为了能启动位于光驱位的系统就只能用bootloader来做二次引导了。

还有一个选择就是把TrueNAS装在U盘或者SD卡上，这样就更方便一些。我之前就是这样做的，但是因为U盘和SD卡的寿命问题，基本上一年左右就会出问题，所以这次下了决心用Grub来引导。

这个方案类似安装多系统，需要用Grub来做启动选择。不同的是需要把Grub做成启动U盘。还有个难点在于TrueNAS是基于FreeBSD的，并且启动盘是ZFS系统，用Grub启动就比较麻烦，我在搜了无数资料加N次重启之后总算是完美启动了。

整体需要两步，一制作Grub启动U盘，二编写TrueNAS的menuentry。

## 一、制作启动U盘

我是找到了这个[uGrub](https://github.com/adi1090x/uGRUB)主题库，然后在Linux下制作的启动盘。

大致的步骤如下：
1、格式化U盘，需要格式化成FAT32格式，这一步其实在Windows下操作更简单。

2、使用grub-install将grub安装到U盘，命令如下：

```
sudo grub-install --force --removable --target=i386-pc --boot-directory=/mnt/GRUB/boot /dev/sda1
```

需要注意的是 *--boot-directory=/mnt/GRUB/boot*，其中 */mnt/GRUB*  是U盘挂载的目录*/mnt/GRUB/boot*是指安装在U盘的boot目录下。*/dev/sda1*是要写入U盘的设备路径。

3、配置uGrub

3.1）下载uGrub
```
$ cd $HOME
$ git clone --depth=1 https://github.com/adi1090x/uGRUB.git
```

3.2）获取U盘的UUID
```
$ sudo blkid
/dev/sdX1: ... UUID="B17C-FEDA" ...
```

3.3）替换*grub.cfg*中的UUID
打开U盘中 *boot/grub/grub.cfg* ，将所有的**YOUR_UUID**替换成U盘的UUID

## 二、编写menu entry

启动TrueNAS的menu entry如下：
```
# TrueNAS
menuentry "TrueNAS" --class freebsd --class bsd --class os {
    insmod part_gpt
    insmod part_bsd
    insmod zfs
    insmod bsd
    search -s -l boot-pool
    kfreebsd /ROOT/default/@/boot/zfsloader
    kfreebsd_loadenv /ROOT/default/@/boot/device.hints
}
```

几个**insmod**是加载了对磁盘gpt、bsd格式的支持及zfs文件系统和bsd系统引导的支持，这几个都是非常重要的。

search命令是搜索标签为**boot-pool**的磁盘分区，这个分区是TrueNAS的启动分区。如果没有加载part_gpt的话，search命令会失败，这是第一个坑。

kfreebsd和kfreebsd_loadenv是需要zfs文件系统的支持，其中路径跟在TrueNAS下看到路径是有区别的，这个是另外一个大坑。这里貌似是Grub对zfs文件系统的支持问题（可以参考[这里](https://forums.freebsd.org/threads/grub2-has-no-zfs-support.25164/#post-352651))，如果用的Grub版本不一样，这里可能会有不同，我一开始使用的路径是参考[这里](https://www.truenas.com/community/threads/any-grub-gurus.95709/post-661782)，这里给的是 **/@/boot/zfsloader**，但是我用的Grub是无法找到这个路径。而且这个参考里也没有提**part_gpt**。


## 三、总结

真的很无奈，总是碰到这样的稀奇需求，需要折腾。前前后后搞了两天，切换了多种方案总算是搞定了。核心原因还是Gen8基本上是属于上古神器了，虽然作为NAS的硬件非常完美，但毕竟是10年前的方案了，最大的问题是不支持UEFI，如果支持UEFI的话就可以直接用rEFInd来引导PCIe转接的M2固态了，就不用这么折腾。唯一值得安慰的就是Gen8的iLO好用，直接可以远程装系统，反反复复重启也就能轻松一点。