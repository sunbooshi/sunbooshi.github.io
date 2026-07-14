---
title: 树莓派ZeroW Wi-Fi共享
date: 2017-08-05 01:51:10
tags:
---

得益于ZeroW的强大Wi-Fi芯片，我们不用再加一个USB Wi-Fi就可以让ZeroW一边连接Wi-Fi，一边共享Wi-Fi，也就是client+AP模式。有朋友问了，既然已经有了Wi-Fi，这样做的意义是什么呢？其中的意义便是本系列文章，暂时不说，各位坐等更新吧。

先来大概讲一讲过程，首先，我们在wlan0上再增加一个网络interface，可以理解为一个虚拟网卡吧（这样可能并不准确）。然后，我们开启内核的端口转发，将虚拟网卡的数据转发到wlan0。之后通过hostapd创建热点，使用dnsmasq为连接到热点的设备分配IP。

实际上在其它派上也可以这样做，前提是你的USB Wi-Fi支持，可以通过如下命令来检查：

```
    sudo iw list

    valid interface combinations:
     * #{ managed } <= 1, #{ P2P-device } <= 1, #{ P2P-client, P2P-GO } <= 1,
      total <= 3, #channels <= 2
     * #{ managed } <= 1, #{ AP } <= 1, #{ P2P-client } <= 1, #{ P2P-device } <= 1,
      total <= 4, #channels <= 1
```

注意输出主要是最后的valid interface combinations:，如果包含这样的输出#{ managed } <= 1, #{ AP } <= 1就表示网卡同时支持作为clinet和AP

下面来详细讲解每一步操作。

### 1. 连接到Wi-Fi
这个就不细说了，只要通过桌面右上角的Wi-Fi图标连接到已有Wi-Fi就可以了。

### 2. 使用如下命令安装所需要的软件：

```
    sudo apt-get install hostapd dnsmasq
```

### 3. 配置rap0的IP地址
编辑`/etc/network/interfaces`，增加如下内容：

```
    iface rap0 inet static
      address 192.168.5.1
      netmask 255.255.255.0
```

注意192.168.5.x这部分不能跟已连接的Wi-Fi一样，需要区分开来。然后重启一下系统。

### 4. 添加AP接口
通过如下命令在wlan0上加上一个新的interface

```
    sudo iw dev wlan0 interface add rap0 type __ap
```

然后执行如下命令，确认已经有rap0接口了

```
    sudo ip addr
```

### 5. 配置dnsmasq

编辑`/etc/dnsmasq.conf`文件增加如下内容

```
    interface=lo,rap0
    no-dhcp-interface=lo,wlan0
    bind-interfaces
    server=192.168.50.1
    domain-needed
    bogus-priv
    dhcp-range=192.168.5.50,192.168.5.150,12h
```


注意dhcp-range要跟第3步中的一致。 然后使用如下命令启用dnsmasq

```
    sudo ifup rap0
    sudo service dnsmasq restart
```

### 6.开启IP包转发

编辑`/etc/sysctl.conf`，去掉以下属性前的注释:

```
    # Uncomment the next line to enable packet forwarding for IPv4
    net.ipv4.ip_forward=1
```

运行`sudo sysctl -p`来启用

然后启用wlan0的nat

```
    sudo iptables -t nat -A POSTROUTING -o wlan0 -j MASQUERADE
    sudo iptables -A FORWARD -i wlan0 -o rap0 -m state --state RELATED,ESTABLISHED -j ACCEPT
    sudo iptables -A FORWARD -i rap0 -o wlan0 -j ACCEPT
```

### 7.配置hostapd
新建一个hostapd文件

```
    sudo vi /etc/hostapd/hostapd.conf
```

内容如下：

```
    interface=rap0
    ssid=RpiAP
    hw_mode=g
    channel=2
    macaddr_acl=0
    auth_algs=1
    ignore_broadcast_ssid=0
    wpa=2
    wpa_passphrase=bbsickey
    wpa_key_mgmt=WPA-PSK
    wpa_pairwise=TKIP
    rsn_pairwise=CCMP
```

注意上面的`interface`就是我们第三步创建的`interface`,
channel这个需要通过`iwlist wlan0 channel`来看wlan0使用的是哪个channel，这一步必须保证和wlan0使用的同一个channel，否则会有问题。 `wpa_passphrase`是热点的连接密码, 其它几项保持默认即可。

保存之后可以通过如下命令来检测一下配置文件是否正确：

```
    sudo hostapd -d /etc/hostapd/hostapd.conf
```

如果在手机上可以连上热点RpiAP，就说明配置没问题。

然后修改`/etc/default/hostapd`文件，加入如下内容：

```
    DAEMON_CONF="/etc/hostapd/hostapd.conf"
```

最后使用`sudo service hostapd restart`来启动热点。

### 8.总结
需要说明的是以上有些步骤在系统重启后就会失效。所以当按照上面的步骤设置完成后，在系统重启以后需要依次执行如下命令重新开启热点。

最重要的一步是使用`iwlist wlan0 channel`查看当前使用的channel，因为每次系统重启wlan0使用的channel可能不一样。而且如果停止了Wi-Fi热点，再次启动的时候也需要再次检查，这一步至关重要。在得到channel以后，更改`/etc/hostapd/hostapd.conf`中的channel，确保两者一致。

```
    sudo iw dev wlan0 interface add rap0 type __ap
    sudo ifup rap0
    sudo service dnsmasq restart
    sudo iptables -t nat -A POSTROUTING -o wlan0 -j MASQUERADE
    sudo service hostapd restart
```

特别需要说明的是启动hostapd会有短暂的断网现象，使用ssh操作，会短暂失去连接，如果一直没有反应的话，说明失败了。
所以第一次进行操作的时候最好不要通过远程操作，不然出问题只能重启系统。

这一篇里还有一个遗留问题，就是重启后需要手动开启热点，主要是需要更改`/etc/hostapd/hostapd.conf`中的channel。如果使用两个USBWi-Fi来创建热点就不存在这个问题了。不过这也不是没有办法解决的，下一篇来解决吧。

最后啰嗦几句，本文内容涉及许多网络知识，多数人都不透彻，包括我在内。我也是参考了很多文章，并且尝试了无数遍以后才确认整个步骤无误。在实践本文时，务必通读到最后，甚至多读几遍让所有操作了然于胸，再动手，不然出错很难检查。另外本文只是个开始，后边还会基于这样的共享来做一些有意思的事情，敬请期待。

本文虽然使用的是ZeroW，但是应该也适应于树莓派3，因为两者使用的同样芯片。对于使用两个USB Wi-Fi来创建热点或者用一个USB Wi-Fi来共享有线网络本文也是适应的，只要理解了各个步骤的含义，针对自己的情况，替换每一步中对应的接口即wlan0，rap0这些与自己的系统对应即可。
