---
title: 在NanoPi M1下使用小度Wi-Fi
date: 2017-05-10 11:12:58
tags:
---

M1的固件nanopi-m1-debian-sd4g-20160907.img.zip已经自带了小度Wi-Fi的驱动——mt7601u，但是没法即插即用，不知道为什么。为了使用小度Wi-Fi需要进行一些设置。

因为大多数讲Wi-Fi的文章都只是列了一下配置，然后就OK，但是自己不成功的话，无从排查问题。本文尝试引入几个命令来帮助排查问题，虽然我也是对整个配置过程一知半解，但了解了这几个命令还是有很大帮助。



## 1. lsusb

插上小度Wi-Fi，我们首先需要确认是不是被系统识别了，那就需要用`lsusb`，首先用如下命令安装`lsusb`：

```
sudo apt-get install usbutils
```

然后执行`lsusb`输出如下：

```
Bus 008 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 007 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 006 Device 002: ID 2955:1001  
Bus 006 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 005 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
```

如果有2955:1001，则表示小度Wi-Fi被识别了，对于其他的设备，可以通过该命令在查看设备的Device ID。



## 2. dmesg

dmesg可以用来查看内核输出的信息，我们用它来查看驱动是否加载了。插上小度Wi-Fi后，在终端中执行`dmesg`命令，如果驱动加载正常在最后会有如下输出：



```
[  142.050149] usb 2-1: new high-speed USB device number 2 using sunxi-ehci
[  141.449845] cfg80211: World regulatory domain updated:
[  141.455614] cfg80211:  DFS Master region: unset
[  141.460469] cfg80211:   (start_freq - end_freq @ bandwidth), (max_antenna_gain, max_eirp), (dfs_cac_time)
[  141.471300] cfg80211:   (2402000 KHz - 2472000 KHz @ 40000 KHz), (N/A, 2000 mBm), (N/A)
[  141.480206] cfg80211:   (2457000 KHz - 2482000 KHz @ 40000 KHz), (N/A, 2000 mBm), (N/A)
[  141.489085] cfg80211:   (2474000 KHz - 2494000 KHz @ 20000 KHz), (N/A, 2000 mBm), (N/A)
[  141.498000] cfg80211:   (5170000 KHz - 5250000 KHz @ 80000 KHz, 160000 KHz AUTO), (N/A, 2000 mBm), (N/A)
[  141.508545] cfg80211:   (5250000 KHz - 5330000 KHz @ 80000 KHz, 160000 KHz AUTO), (N/A, 2000 mBm), (0 s)
[  141.519081] cfg80211:   (5490000 KHz - 5730000 KHz @ 160000 KHz), (N/A, 2000 mBm), (0 s)
[  141.528078] cfg80211:   (5735000 KHz - 5835000 KHz @ 80000 KHz), (N/A, 2000 mBm), (N/A)
[  141.530052] usb 2-1: reset high-speed USB device number 2 using sunxi-ehci
[  141.544599] cfg80211:   (57240000 KHz - 63720000 KHz @ 2160000 KHz), (N/A, 0 mBm), (N/A)
[  141.683042] mt7601u 2-1:1.0: ASIC revision: 76010001 MAC revision: 76010500
[  141.699552] mt7601u 2-1:1.0: Firmware Version: 0.1.00 Build: 7640 Build time: 201302052146____
[  142.113339] mt7601u 2-1:1.0: Warning: unsupported EEPROM version 0d
[  142.120500] mt7601u 2-1:1.0: EEPROM ver:0d fae:00
[  142.126447] mt7601u 2-1:1.0: EEPROM country region 01 (channels 1-13)
[  142.372181] ieee80211 phy0: Selected rate control algorithm 'minstrel_ht'
[  142.374575] usbcore: registered new interface driver mt7601u
```



也可以使用`dmesg | grep mt7601`来精简输出：

```
​	[   10.030133] mt7601u 6-1:1.0: ASIC revision: 76010001 MAC revision: 76010500
​	[   10.495110] mt7601u 6-1:1.0: Warning: unsupported EEPROM version 0d
​	[   10.507867] mt7601u 6-1:1.0: EEPROM ver:0d fae:00
​	[   10.527104] mt7601u 6-1:1.0: EEPROM country region 01 (channels 1-13)
​	[   11.465717] usbcore: registered new interface driver mt7601u
```

只要看到`usbcore: registered new interface driver mt7601u`就表示小度Wi-Fi已经被识别出来了并且加载了。

## 3. lsmod 和 modinfo

假入没有类似输出，我们可能要进一步确认mt7601u是不是加载了，那就需要用`lsmod`，正常来说会输出如下内容：

```
Module                  Size  Used by
mt7601u                73012  0
mac80211              495881  1 mt7601u
cfg80211              470289  2 mac80211,mt7601u
mali_drm                5741  1
mali                  194124  0
ump                    37786  3 mali
rfcomm                 21114  4
bnep                    9149  2
hci_uart               11776  0
btbcm                   5304  1 hci_uart
bluetooth             300113  10 bnep,btbcm,hci_uart,rfcomm
compat                 25372  7 bnep,cfg80211,mac80211,mt7601u,hci_uart,rfcomm,bluetooth
```



可以看到mt7601已经加载了，但是没用啊。我们在用`sudo modinfo mt7601u`来查看驱动的具体信息，正常输出如下：

```
filename:       /lib/modules/3.4.39-h3/updates/drivers/net/wireless/mediatek/mt7601u/mt7601u.ko
version:        backported from Linux (v4.4.2-0-g1cb8570) using backports v4.4.2-1-0-gbec4037
license:        GPL
firmware:       mt7601u.bin
srcversion:     06486A44A19698210D54450
alias:          usb:v7392p7710d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v2A5Fp1000d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v2955p1001d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v2955p0001d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v2717p4106d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v2001p3D04d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v148Fp760Dd*dc*dsc*dp*ic*isc*ip*
alias:          usb:v148Fp760Cd*dc*dsc*dp*ic*isc*ip*
alias:          usb:v148Fp760Bd*dc*dsc*dp*ic*isc*ip*
alias:          usb:v148Fp760Ad*dc*dsc*dp*ic*isc*ip*
alias:          usb:v148Fp7601d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v13D3p3434d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v13D3p3431d*dc*dsc*dp*ic*isc*ip*
alias:          usb:v0E8Dp760Bd*dc*dsc*dp*ic*isc*ip*
alias:          usb:v0E8Dp760Ad*dc*dsc*dp*ic*isc*ip*
alias:          usb:v0B05p17D3d*dc*dsc*dp*ic*isc*ip*
depends:        mac80211,compat,cfg80211
vermagic:       3.4.39-h3 SMP preempt mod_unload ARMv7 p2v8
```

注意其中的alias，其中的`usb:vXXXXpXXXd`这部分实际上对应的是USB设备的deviceID，所以需要看一下有没有小度Wi-Fi的ID：2955:1001，如果没有，那么你需要自己编译mt7601来支持了，M1自带的是支持小度Wi-Fi的。所以一切正常的话，完全可以驱动起来。对于其他Wi-Fi设备，可以通过lsusb来获取DeviceID来查看驱动是否支持。



## 4. ip addr

虽然mt7601支持小度Wi-Fi，内核也提示已经创建了接口，但是通过`sudo ifconfig`还是看不到wlan0。这时我们需要用`sudo ip addr`来确认是不是已经创建wlan0了还是有其他的网络接口（实际官方的mt7601驱动创建的是ra0网络接口），假设你使用过其他Wi-Fi设备，此时为小度创建的接口可能是wlan1，这个需要确认一下。

```
7: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether xx:xx:xx:xx:xx:xx brd ff:ff:ff:ff:ff:ff
```

可以根据link/ether后的Mac地址：xx:xx:xx:xx:xx:xx来确认哪个接口是小度Wi-Fi。

如果这里没有小度Wi-Fi输出的话，说明驱动还是有问题，但是我也不知道该从哪里去查了。



## 5. 配置小度Wi-Fi

到此为止，我们基本就可以定位小度Wi-Fi的驱动问题了。下一步就是配置来启用小度Wi-Fi。

### 5.1 启用wlan0

这里我们需要根据ip addr的输出来确认是wlanX。编辑`/etc/network/interfaces`文件，增加如下内容：

```
auto wlan0
allow-hotplug wlan0
iface wlan0 inet dhcp
```

重启系统或者使用`sudo /etc/init.d/networking restart`来重启网络。

这时使用`sudo ifconfig`应该可以看到wlan0了。



### 5.2 连接无线网络

编辑`/etc/wpa_supplicant/wpa_supplicant.conf`文件增加如下内容：

```
ctrl_interface=/var/run/wpa_supplicant
network={
	ssid="XXXXXX"
	psk="YYYYYY"
}
```

其中是`XXXXXX`你要连的无线网络名称，` YYYYYY`是网络的密码。

然后执行如下命令来连接网络：

```
sudo wpa_supplicant -B -iwlan0 /etc/wpa_supplicant/wpa_supplicant.conf
```

此时，应该还是没有网络，需要使用如下命令来开关一下wlan0

```
sudo ifdown wlan0 # 关闭wlan0
sudo ifup wlan0   # 启用wlan0
sudo ifconfig     # 应该可以看到wlan0已经获取IP了
```

### 5.3 开机连接Wi-Fi

如果想要开机时自动连接Wi-Fi，需要编辑`/etc/network/interfaces`文件，在5.1中增加的内容之后加入如下内容：

```
pre-up /sbin/wpa_supplicant -B -iwlan0 -c/etc/wpa_supplicant/wpa_supplicant.conf  
post-down killall -q wpa_supplicant
```



至此，小度Wi-Fi就完全配置完成了。

最后啰嗦两句，从树莓派2代开始，就一直想要用上小度Wi-Fi，但一直以来都是以失败告终，几乎无从查找原因。这次又有时间折腾，先是编译了M1的内核，接着又自己编译了mt7601的驱动，其中经历又颇为曲折，但是总算是理清了大致的脉络，然后发现M1是默认支持小度的，但是却没有详细的设置教程，而且debian桌面上的wicd也是无法识别，所以又各种搜索，总算是驱动起来了，心中甚是畅快。但回顾起来又不免感慨，正所谓授人以鱼不如授人以渔，能搜的帖子大多都是“鱼”，单单是4中讲到的确认接口的问题估计就会让好多人无法设置成功，因为很可能是wlan1而不是wlan0。虽然本文远未到“授人以渔”的程度，但多少提供了一些命令来排查各个环节，尽管是以M1为基础环境，但在树莓派、香蕉派等上仍适用。希望各位能用好自己手中的小度Wi-Fi、米Wi-Fi和360Wi-Fi等。
