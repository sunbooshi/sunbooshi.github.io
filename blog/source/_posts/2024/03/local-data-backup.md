---
title: 低成本数据安全保障方案
date: 2024-03-09 18:07:37
tags:
---


年前我的Ubuntu文件系统损坏，系统无法启动，把硬盘拆下来也没法正常读取，写的一些小项目都没有备份，感觉很郁闷。庆幸的是前几天又折腾了好半天，最终使用R-Linux恢复了。痛定思痛，我想了一个低成本的数据保障方案：本地双（多）硬盘同步+重要数据云端同步。

目前我的Ubuntu主要是运行一些docker服务，比如笔记同步、VaultWarden、Memos、Jellyfin、RSS订阅。还有作为日常的开发机，通过VSCode远程开发还是很舒服的。所以对我来说主要是两部分数据需要备份，一是Docker服务数据，二是代码。如果所有数据都做云端备份，一是同步数据量大，二是成本很高。比如开发过程产生的一些文件，像是node_modules这些目录既大又没有必要去同步。

所以根据我构思的方案，把这些数据划分为重要数据和普通数据。重要数据需要做云端同步，对我而言主要是笔记数据，密码，Memos这些，不是很大，目前大概是几十兆，预计极限也就是百兆级别的，而且同步频率也不用很高，压缩后每天同步即可。普通数据只做本地多硬盘同步，或者NAS同步即可。特别是现在二手硬盘十分便宜，而且很多人手上都应该有淘汰下来的机械硬盘，SATA硬盘之类的，本地多硬盘同步可以很好的利用这些旧硬盘，让它们继续服役。归根到底这就是利用便宜的二手硬盘做数据冗余存储，用极低的成本尽可能的保障数据安全。而且是应用层面的同步，方案非常灵活，本质就是目录同步，如果机器的盘位比较多，可以多买几块硬盘，同时备份到多个硬盘，只要有一块硬盘没坏就可以很容易的恢复数据。

![](/images/2024/20240309180901.png)

## 1、本地目录同步
### 方案1：rsync同步

首先要做一下整体的目录规划，尽量将数据放到统一的目录下，比如所有docker服务的数据都放在`/var/homelab/data`目录下，代码全放在`/home/booshi/work`目录下。这样本地双硬盘备份就可以通过`rsync`来将这两个目录同步的备份硬盘。

同步脚本如下：
``` shell
#!/bin/bash
# 本地同步脚本，将指定的目录同步到第二块备份硬盘

# 需要同步的目录
# 注意目录结尾不能有/，必须按下面的示例写
src_dirs=("/home/booshi/work" "/var/homelab")
# 备份存储目录，支持多个磁盘上的目录
dst_dirs=("/mnt/backup1" "/mnt/backup2")

echo `date`

for s in "${src_dirs[@]}"; do
  for d in "${dst_dirs[@]}"; do
    echo "sync $s to $d"
    rsync -av --delete $s $d
  done
done
```

仅仅十多行代码就可以完成数据同步了，支持多个目录向多个硬盘同步，使用的时候只需修改`src_dirs`将需要备份的目录添加进去，然后修改`dst_dirs`指定备份存储的目录，**注意一定要是不同于src_dirs所在的其他硬盘才有意义。**

将代码保存到`/usr/local/bin/localsync.sh`，然后执行如下命令添加执行权限
```
sudo chmod +x /usr/local/bin/localsync.sh
```

因为Docker中有些服务必须是以root用户来运行的，为了保证所有数据都能被同步也需要以**root**用户来执行定时任务。使用如下命令设置定时任务：

```
sudo crontab -e
```

在文件的最后添加如下内容

```
# local sync
30 */6 * * * /usr/local/bin/localsync.sh >> /var/log/localsync.log 2>&1  
```
这个定时任务是每六小时30分钟同步一次，一天共运行4次，分别是00:30，06:30，12:30，18:30，基本上足够了，因为rsync只同步变化的文件，也不会太耗时。

关于rsync的详细使用可以参考这里（[https://www.ruanyifeng.com/blog/2020/08/rsync.html](https://www.ruanyifeng.com/blog/2020/08/rsync.html)）
rsync不仅支持本地，也可以同步到远程，如果有TrueNAS，可以启动rsync服务，使用rsync同步的TrueNAS，或者使用ssh同步。


### 方案2：ZFS快照同步
还有一个方案是利用ZFS文件系统的快照功能，Ubuntu现在已经支持ZFS文件系统了，可以很轻松的使用。快照的好处是可以处理**文件被误删**的情况，不过方案1并不是实时同步，是有一定的滞后性，也能在一定程度上处理文件误删。但ZFS文件系统创建快照的成本很低，可以购买大容量硬盘，滚动创建快照，可以保留30天，20天，10天，近7天，以及24小时内每小时的快照，这样基本可以覆盖所有被误删的情况了。不过ZFS的处理方式就不如使用`rsync`来直观一些。目前我对ZFS还不是特别熟练，只是调研了一下可行性，还没有实践，后面补充。


## 2、云端同步
本地双硬盘备份也不是100%安全，特别是用了旧硬盘，如果点背或者突然断电也是有可能所有硬盘都挂了。所以像笔记、VaultWarden、Memos这些比较重要的数据还需要每日同步到云端，然后云端保存近7日的数据，滚动更新。这样基本就能做到可靠的数据安全了。云端服务端话推荐使用七牛，免费用户可以有10G的存储空间，将空间设置为私有，因为只做备份所以也不会产生外部流量。

注册好七牛，并且创建好对象存储空间后，就可以下载安装七牛的qshell，参考[这里](https://developer.qiniu.com/kodo/1302/qshell#3)，可以直接把qshell复制到 **/usr/local/bin** 目录下。然后使用qshell登录到七牛，参考[这里](https://developer.qiniu.com/kodo/1302/qshell#4)。

同步脚本如下：
``` shell
#!/bin/bash
# 本地目录压缩后上传到七牛

# 本地需要备份的目录
backup_dirs=("/var/homelab/data/memos" "/var/homelab/data/vaultwarden" "/var/homelab/data/commafeed")
# 七牛的存储空间名称
space="homelab-backup"
# 备份文件的解压密码
password="yourpassword"
# 备份文件前缀
name="docker"


datetime=`date +%Y%m%d`
zipname=${name}${datetime}.zip
localpath=/tmp/${name}${datetime}
localzip=/tmp/$zipname
remotepath=${name}/`date +%Y`/`date +%m`/${zipname}

mkdir $localpath

echo "copy data"
for d in "${backup_dirs[@]}"; do
  cp -rp $d $localpath
done

echo "create zip $localzip"
zip -rqP $password $localzip $localpath

echo "upload to qiniu: $remotepath"
/usr/local/bin/qshell fput $space $remotepath $localzip

echo "del $localpath"
rm -fr $localpath

echo "del $localzip"
rm $localzip
```
使用的时候修改`backup_dirs`，`space`和`password`即可，有了密码也是可以避免云端数据被泄漏的情况。将脚本保存到`/usr/local/bin/remotesync.sh`，然后执行如下命令添加执行权限
```
sudo chmod +x /usr/local/bin/localsync.sh
```
同样使用root设置定时任务：
```
sudo crontab -e
```
在文件的最后添加如下内容
```
# remote sync
0 4 * * * /usr/local/bin/remotesync.sh >> /var/log/remotesync.log 2>&1  
```
这个定时任务是每天凌晨4点同步一次。

## 3、总结

只要两个脚本，一块旧硬盘，一个免费的七牛帐号，我们就能用极低的成本实现小规模数据安全保障，性价比极高，而且十分灵活，只要按照目录维度做好规划即可。对于使用树莓派的朋友，可以外接一个USB硬盘的方式使用本文的方案，同样的，如果设备没有多余盘位也可以采用移动硬盘的方案。如果还有NAS，可以直接挂载NSA共享的smb来做NAS同步，这样数据基本是99.9％的可用度了，对于个人用户而言足够了。再加上云端备份，即使本地硬盘全挂，也能有最终保底。