---
title: 基于FreeBSD搭建BT下载机
date: 2023-08-03 17:02:24
tags:
---
之前我用PVE做了个4盘位的下载机，但最近半个月接连出了两次问题，上一次是掉盘，重启之后好了。这次干脆无法启动，可能是系统盘出了问题。在掉盘那次，我就开始规划新下载机了，所以这次启动不了我就不想去排查到底是什么原因了。

PVE拿来做虚拟化确实不错，我现在的主路由是一台NUC，我在这台NUC上装了PVE，然后又在PVE上安装了OpenWRT做独臂路由。这台NUC虽然便宜，但只跑OpenWRT属实浪费，所以我还跑了个Ubuntu的Server。在整下载机的时候就自然想到了继续用PVE，虚拟两个系统一个做BT下载，一个做PT下载，在出问题之前也是跑的很开心的。

但出问题之后，我就觉得PVE太重了，而且PVE我也没有玩明白，还是有点复杂了。我这次装机的目的也很明确，只用来下载，力求轻量化，低功耗，两个硬盘，一个用于BT下载，一个用于PT下载。好巧不巧的是发现了一块ASUS J2900主板，闲鱼只要100块，一切都水到渠成，开整！

# 硬件配置

|    |    |
| -- | -- |
| 主板： | ASUS J2900-K/K31AN |
| 内存： | 4G ddr3 |
| 硬盘： | 系统盘铨兴128G nvme，下载盘2块4T西数紫盘 |
| 电源： | 19v DC电源 |

这块华硕的J2900小板真是太符合我的需求了，DC供电，两个sata+一个pcie。DC供电可以省掉一个DC-ATX模块，也能让整机更整洁。之前的下载机就是线太乱了。pcie可以转接m.2做系统盘，两个sata正好接2个4T硬盘。这样就可以做到系统和下载存储分离，可以随时更换新的下载盘。不过其实用nvme有点奢侈了，还好最近固态硬盘价格很低了，这个128G的铨兴花了79块，价格可以。希望能经得起7x24小时的开机。整体配置非常够用了，唯一的遗憾是内存，要用ZFS的话官方推荐的是8G，但卖家送了4G，主板又只有一个内存槽，能省则省吧，先跑一段时间看看再说。

不过因为是很老的主板了，所以不支持直接从m.2启动，得插个U盘通过U盘启动系统。光是这个就折腾了半天，本来想用PXE启动实现，但是大概率还是主板太老了，最终没成功，只能老老实实回到U盘的路子上。最郁闷的是因为我打算用FreeBSD，网上的方案基本都是用Clover，而Clover不支持FreeBSD。找了一圈最后发现了rEFind这个启动方式，但是还是需要单独处理一下。所以，100块买的小板，又花了大精力折腾系统启动了。如果这块主板原生支持nvme启动的话，基本就是完美了。

# 系统选型

系统最终是选用了FreeBSD，然后通过Jail虚拟化运行两个独立的qBittorrent下载系统。

为啥会想到用FreeBSD呢？这还是要回到核心诉求，轻量级下载机，不仅硬件轻量，系统也要轻量。PVE好是好，但是对于轻量下载需求来说，还是太重了，而且各种配置我也没有掌握。如果用Linux的话我首选是Ubuntu，不过Ubuntu一方面对我的下载需求来说太重了，另外之前不小心装了一次非长期支持的版本，跑了好久要装其他工具的时候发现已经不支持了，这让我很尴尬。我其实也想过用Alpine Linux，够精简，但也是Linux，我还是想趁这次玩点新花样，所以最终敲定了FreeBSD。一方面FreeBSD自带Jail虚拟化方案，另一方面FreeBSD的大版本的生命周期很长，应该是可以做到一次安装永不更新，如果没有严重问题，我实在不想花时间在更新系统上。所以整个系统的核心诉求是轻量，可以运行5年以上不更新系统。

关于Jail，实在是过于轻量化了。我一开始是拿Docker的经验来学习Jail，后来发现两者还是比较大的区别。Jail没有Image的概念，你只需要把FreeBSD的Base系统解压到某个目录里就可以了。这也也就带来一个问题，不能像Docker那样直接pull一个镜像过来就好了，基本上需要自己动手做。当然也可以用iocage这样的工具来创建和管理jail，像FreeNAS，TrueNAS都是用iocage来管理jail的。但还是在于轻量这个核心诉求，让系统尽可能的简单，而且我也只是需要安装qBittorrent就可以了，就没必要再安装iocage。

# Jail配置
## 网络设置

网络部分是最核心的设置了，如果网络不通，就别谈下载了。另外，现在大部分地区都有ipv6，如果能给Jail分配到ipv6是可以提升下载速度的。现在不管是Linux还是FreeBSD，网络部分是相当的强大。在FreeBSD下可以直接使用vnet，让Jail有独立的网络栈，可以轻松实现像VBox那种桥接、NAT的网络模式。但相较于VBox勾选一下就能完成配置，配置vnet就太繁琐，太麻烦了，特别是对于FreeBSD还没那么熟悉的我了，几乎是薅掉所有头发。

这里其实有两个需求，第一是建立jail和宿主之间的网络连接，第二是建立jail和外部网络的连接，也就是能从路由拿到IP地址。而且还希望局域网内的其他设备能访问到这两个下载Jail，所以只能桥接模式。

### 1、建立jail和宿主之间的网络连接

这一步需要使用epair创建两个网络接口，epairXa 和 epairXb，这两个接口直接互相连接。
直接使用如下命令创建
```
ifconfig epair create
```

可以通过下面的命令查看已有的，epair接口
```
ifconfig -g epair
```
这里，假设刚创建的两个接口分别是epair0a、epair0b，我们把epair0b配给jail。

### 2、建立jail和外部网络的连接

其实这一步就是把分配给jail的epair0b给桥接到系统的re0网口上。既然是桥接就得用到bridge，很简单，只要使用下面的命令就可以创建一个桥接，我感觉就是理解成一个虚拟交换机。
```
ifconfig bridge create up
```
假设建好的桥接接口是bridge0。我们把bridge0理解成交换机后，那就是把re0和epiar0b直接拿网线插到交换机上就好了。需要注意的是epiar0b分配给jail后，在宿主是看不到这个接口的，但是epiar0b和epiar0a是直接连通的，所以我们只要把epiar0a和re0的连接到bridge0上就行了。使用addm参数可以把epiar0a和re0作为member加到bridge0中，命令如下：
```
ifconfig bridge0 addm re0 addm epair1a
```
如果要从中删接口，可以使用如下命令：
```
ifconfig bridge0 deletem re0 
```

这里需要特别说明，一旦一个接口，比如re0加入到某个bridge之后就不能再加入其他的bridge了。
所以我们如果创建多个jail的话，所有的epairXa都只能加到一个bridge里和re0连接。

最后，使用如下命令把刚刚创建的接口都启用
```
ifconfig bridge0 up
ifconfig epiar0a up
```
epiar0b需要在jail中启用。

这样就把jail所需要的网络接口就配置好了。

### 3、Jail配置文件

```
bt {
    host.hostname = bt;                        # Hostname
    path = "/home/jail/bt";                    # Path to the jail
    mount.devfs;                               # Mount devfs inside the jail
    exec.start = "/bin/sh /etc/rc";            # Start command
    exec.stop = "/bin/sh /etc/rc.shutdown";    # Stop command
    
    vnet;                                      # 启用vnet，必须配置
    vnet.interface = "epair0b";                # 指定vnet的接口

    command ="ifconfig epair0b inet 192.168.1.205/24";  # 设置jail的静态ip地址
    command +="route -n add -inet default 192.168.1.1";  # 设置路由地址
}
```
整个配置非常简单。需要注意的就是vnet那两行及下面的command三行。

vnet的部分就给Jail分配我们创建好的epair网络接口

command部分是给epair接口配置ipv4，给jail一个固定的ipv4地址。注意，如果是要使用dhcp获取ip地址的话就会麻烦一些。一方面启用dhcp需要在Jail多运行一个dhclient进程，另一方面还要配置专门的devfs_ruleset，将bpf挂载到Jail。ROI太低，完全不推荐。

ipv6的配置不能直接用command的方式，无法获得公网ipv6，只能修改Jail的rc.conf文件配置。在 **/home/jail/bt/etc/rc.conf**文件中添加如下内容： 
```
ifconfig_epair0b_ipv6="inet6 accept_rtadv"
```


### 4、持久化
前面三步执行的操作在系统重启后bridge0、epiar0a、epiar0b接口都会消失。为了让bridge0、epiar0a、epiar0b一直存在，需要在 **/etc/rc.conf** 中配置一下。
```
cloned_interfaces="bridge0 epair0"
ifconfig_bridge0="addm re0"
```

同时，Jail配置文件也需要配合调整：
```
bt {
    host.hostname = bt;                        # Hostname
    path = "/home/jail/bt";                    # Path to the jail
    mount.devfs;                               # Mount devfs inside the jail
    exec.start = "/bin/sh /etc/rc";            # Start command
    exec.stop = "/bin/sh /etc/rc.shutdown";    # Stop command
    
    vnet;                                      # 启用vnet，必须配置
    vnet.interface = "epair0b";                # 指定vnet的接口

    command = "ifconfig epair0b inet 192.168.1.205/24";  # 设置jail的静态ip地址
    command += "route -n add -inet default 192.168.1.1";  # 设置路由地址

    exec.prestart += "ifconfig bridge0 addm epair0a";
    exec.prestart += "ifconfig epair0a up";
    exec.poststop  = "ifconfig bridge0 deletem epair0a";
}
```
主要是增加了prestart、poststop，对epair0a进行了处理。

## 数据目录挂载
zfs文件系统用起来实在是过于方便了，完全不存在什么磁盘格式化的说法。只要一个命令就能创建ZFS磁盘池。

```
zpool create bt /dev/da0
```
上面的命令是把硬盘/dev/da0创建了名为bt的磁盘池（这句描述是比较别扭的）。bt会自动挂载到/bt，但是/bt不是传统意义的目录，还不能直接使用，需要使用如下命令创建数据集，数据集就可以当成目录使用了。
```
zfs create bt/download
```
可以使用df命令查看一下成果。

因为只是下载，也用不了多少zfs的高级功能，所以创建好数据集后基本就足够了。下一步就是把刚创建的bt/download挂载到Jail中，比较简单的是直接使用set mountpoint挂载。命令如下：

```
zfs set mountpoint=/home/jail/bt/data bt/download
```
上面的命令是把刚创建的bt/download直接挂载到了Jail的/data目录。

也可以通过mount命令挂载：
```
mount -t nullfs -o rw /bt/download /home/jail/bt/data
```
在重启系统后，需要重新执行这个命令，所以可以通过写入fstab或者在Jail配置中来实现重启自动挂载。
如果使用fstab，可以在 **/etc/fstab** 添加如下内容：
```
/bt/download    /home/jail/bt/data		 nullfs     rw		     0	     0
```
或者在Jail配置添加如下内容：
```
exec.prestart+="mount -t nullfs -o ro /bt/download /home/jail/bt/data";
```
这行配置是告诉Jail在启动前执行mount命令。通过Jail配置的方式是比较推荐的，因为很清晰的知道这个Jail使用了宿主的哪个数据集。

# qBittorrent安装
FreeBSD的pkg源里有qBittorrent，所以直接安装就可以了。


# 完整的配置文件

```
bt {
    host.hostname = bt;                        # Hostname
    path = "/home/jail/bt";                    # Path to the jail
    mount.devfs;                               # Mount devfs inside the jail
    exec.start = "/bin/sh /etc/rc";            # Start command
    exec.stop = "/bin/sh /etc/rc.shutdown";    # Stop command
    
    vnet;                                      # 启用vnet，必须配置
    vnet.interface = "epair0b";                # 指定vnet的接口

    command = "ifconfig epair0b inet 192.168.1.205/24";  # 设置jail的静态ip地址
    command += "route -n add -inet default 192.168.1.1";  # 设置路由地址

    exec.prestart += "ifconfig bridge0 addm epair0a";
    exec.prestart += "ifconfig epair0a up";
    # 如果用prestart方式挂载，可以把下面这行的注释去掉
    # exec.prestart+="mount -t nullfs -o ro /bt/download /home/jail/bt/data";
    exec.poststop  = "ifconfig bridge0 deletem epair0a";
    # 如果用prestart方式挂载，可以把下面这行的注释去掉
    # exec.poststop  += "umount /home/jail/qbt/data";
}
```

将上面的内容放到 **/etc/jail.conf** 就可以开机启动了。如果不想开机自动启动，可以放到 **/etc/jail.conf.d/bt.conf**

# 总结
折腾真是其乐无穷，断断续续的花了些时间总算是构建了理想的下载系统，无论是整机功耗，系统都达到了最理想的状态，剩下的就是用时间来验证系统的稳定性了，而且体积也很好的控制。其实最理想的形态，两盘位下载机就是两块硬盘堆叠的大小，但是目前没有合适的主板。我甚至想过用树梅派+一块8T硬盘这样也能做到足够小。但问题在于，树梅派现在也不便宜，系统长期运行在SD卡上很容易挂掉，文件共享未必能跑满千兆带宽等等现在2.5G网卡隐隐已经成为趋势了，树梅派的性能可能还是不够，价格又贵。

综上，我的终极目标其实是想自己设计一个下载主板，CPU我都选好了，RK3588，有PCIE也有SATA3.0。我的思路是直接设计类似nas那种硬盘背板，然后把RK3588集成到背板上，做2~4盘位的背板，板载emmc或者m.2接口做系统盘，8G或16G内存。整机的大小基本就是硬盘堆叠的大小，不过整体成本应该也不会太低。最大的问题在于，我没有这个设计能力，而且这种pcb的设计一旦有问题会影响整体的性能，不是我这种门外汉学几天就能搞定的。但这个方案绝对是一个完美轻量化的下载系统或者桌面nas系统。

不过，现在最大的问题是固态硬盘价格节节下降，大容量固态硬盘不再是奢望。现在其实已经有了纯nvme的nas了，而且会越来越多。所以，如果是使用nvme做存储的话，那可以做成手机大小的随身nas或下载机了，那就是精致完美的桌面nas或者移动nas。我估计随着固态硬盘价格的进一步下降，这样随身nas系统很快就会出现了。

最后，其实还有很多细节没有写，否则篇幅就太长了。像是rEFind的使用就可以写一个短篇，后续下载文件的权限、smb局域网共享，以及在Windows下自动发现（使用wsdd）也都能单独再写一篇。我估计应该有很少人会有跟我一样的需求，并且愿意使用FreeBSD，也就懒得再写了。