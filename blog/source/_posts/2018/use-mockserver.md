---
title: 使用MockServer进行API数据Mock
date: 2018-12-13 23:33:34
tags:
---

## 一、为何用MockServer
我们的App极度依赖后台数据，在开发过程中经常处于等待后台开发完成的状态，而且有一些特别的情景一时半会还没有合适的数据，这就特别尴尬，所以就想到了数据Mock。针对我们的情况，对数据Mock有以下的要求： 

* 尽可能小的影响项目；
* 不需要写额外代码； 
* 方便Mock数据而不影响项目；
* 能够“录制、回放”请求 ；

主要是第3点，之前接触了OHHTTPStubs，OHHTTPStubs主要是针对单元测试需要把数据写在代码中或者存放到工程中。但我们现在只是想满足开发需求，所以使用OHHTTPStubs并不合适。后来听同事说到了MockServer，MockServer的优势在于它可以作为代理服务器使用，如果请求满足规则它就返回Mock数据，否则就会透传给服务端，不会影响其他的功能。而且关于Mock数据的设置都是在工程之外，这样几乎对项目没有什么影响，我们也不需要写额外代码，只需要专心构建Mock数据即可。 

## 二、启动MockServer
MockServer的使用也比较简单，只需要从这里http://www.mock-server.com/where/downloads.html下载一个jar包就行，然后使用如下命令启动MockServer：

java -jar mockserver-netty-5.5.0-jar-with-dependencies.jar -serverPort 1080 -logLevel INFO
MockServer对外只提供了API而没有图形界面，设置Mock数据稍微有些繁琐，我又做了一个[简易的Web页面](https://gist.github.com/sunboshi/8315c34e18213eb769456720d4d6dfa5)来操作MockServer。

![](/images/2018/mock01.png)

这个Web主要提供了添加、删除和重放数据的功能，满足了大多数使用情况，使用起来也很简单。

首先选择HTTP Method，然后设置网络请求的路径，最后在文本框中输入Mock数据，点击添加即可。

使用已录制的数据，也是同样的操作，但是不需要输入Mock数据。在使用已录制的数据时，一定要确保MockServer已经抓取到了该路径的返回数据。

来一个简单的例子，将路径设置为/test/mockserver，返回数据设置为HelloWorld，如下图所示：

![](/images/2018/mock02.png)

然后使用curl来测试一下，先不使用代理

```
curl http://www.baidu.com/test/mockserver
```

 返回内容如下：

```
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>302 Found</title>
</head><body>
<h1>Found</h1>
<p>The document has moved <a href="http://www.baidu.com/search/error.html">here</a>.</p>
</body></html>
```

然后使用代理，

```
curl -x 'http://localhost:1080' http://www.baidu.com/test/mockserver
```

返回内容如下：

```
HelloWorld
```

在使用了代理之后返回内容就是我们在MockServer中设置的数据了。

## 三、在代码中启用MockServer代理
另外需要注意的是，因为使用了代理的方式，对HTTPS的支持可能会有问题。而且在iOS中是无法使用代码设置HTTPS代理。 

为了使用MockServer，我在OPNetAdapter（https://github.com/sunboshi/OPNetAdapter）加入了代理的支持，如果在模拟器上开发，使用如下代码开启代理： 

```
[OPDataRequestConfig setHttpProxy:@"localhost" port:1080];
[OPDataRequestConfig setHttpProxyEnable:YES];
```

在iOS真机上使用，需要确保真机与电脑在同一局域网，然后将localhost改为电脑的IP地址。

在AFNetWorking中使用如下代码设置代理：

```
NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];

config.connectionProxyDictionary = @{
   (NSString *)kCFNetworkProxiesHTTPEnable: @(YES),
   (NSString *)kCFNetworkProxiesHTTPProxy: host,
   (NSString *)kCFNetworkProxiesHTTPPort: @(port)
   };

AFHTTPSessionManager *manager = [[AFHTTPSessionManager alloc] initWithSessionConfiguration:config];
```