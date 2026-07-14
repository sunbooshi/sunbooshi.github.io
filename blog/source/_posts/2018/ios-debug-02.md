---
title: iOS捉虫记02
date:  2018-09-21 17:34:34
tags:
---
Bug年年有，今年特别多，而且还是一些特别奇怪的Bug。 

## 一、Runloop
这个Bug很诡异，简直可以排进我见过的诡异Bug前十之列，主要是思路上太混淆人了。 

### Bug描述： 

云盘里文件夹中的文件列表时而有时而没有。 

解决Bug一个比较关键的手法就是一步一步排除，先从源头开始。好就好在这个Bug比较容易复现，因为列表内容是通过接口获取的，那就直接看网络请求的结果好了，然后就发现，根本没有发起网络请求。这就很奇怪了，从代码来看请求的确是创建了，但是的确没有返回数据。因为这部分的代码比较古老，还是用NSOperation写的，而在发起请求的时候发现还会取消之前的请求，这时第一反应，这个地方可能出问题了，直接先把这部分代码注释掉。结果，帅不过三秒，还是有问题，那就只能再深入代码去看了。 

网络请求部分因为使用了NSOperation，然后又用了NSOperationQueue来做请求管理，当一个请求创建后，会加入Queue来管理，而这个Queue设置了最大并行数是1，也就是说，同时只能有一个Operation执行，然后在出现Bug的时候，发现队列里已经有多个Operation，那就说明某个Operation被阻塞了，所以请求创建了，而且也加入到Queue里，但是因为正在执行中的Operation阻塞了，导致其他的Operation都没法执行，自然就没有发出请求。直接把最大并行数设置成10，问题就没了。 

但是，这个并不是根本问题，根本不知道为什么Operation会阻塞。Xcode调试有个比较好用的功能，直接暂停就可以很轻易的找到线程阻塞的地方，App大概有十几线程，一个一个看下来，果然有一个Operation，然后一看代码，居然是 [[NSRunLoop currentRunLoop] run]，因为我对Runloop也是云里雾里的，完全想不通为什么会在这里阻塞，搜了一圈也没结果，无奈的去看了一下文档，然后就发现了： 

> If you want the run loop to terminate, you shouldn't use this method. Instead, use one of the other run methods and also check other arbitrary conditions of your own, in a loop. A simple example would be:

```
BOOL shouldKeepRunning = YES; // global

NSRunLoop *theRL = [NSRunLoop currentRunLoop];

while (shouldKeepRunning && [theRL runMode:NSDefaultRunLoopMode beforeDate:[NSDate distantFuture]]);
```

这个run函数确实会被阻塞的，但至于为什么被阻塞，被谁阻塞是很难去追查的了。按照官方的写法修改之后，问题迎刃而解。 

其实这个Bug并不难追查，但是因为这个云盘代码是从我们的App移植到出Bug的App中的，因为云盘部分代码是云盘服务商提供的，而且是多年前的代码了，因为过于复杂和庞大，一直就这么保留着，没人敢动。出Bug的App，这里简称BApp吧，他们也是费劲九牛二虎之力才整合进去，所以有了这么一层原因之后，就导致他们一直以为是集成过程中出的问题，因为在我们的App并没有这个Bug。 

最终这个Bug耗费了他们太多精力，又实在不知道从哪里开始查，云盘的代码几乎是一个完整的App代码，又着急发版，最终找到了领导，领导又找到了我，让我找够帮手去解决。好就好在这个Bug比较容易复现，一开始我们的思路也是从集成的角度入手，以为遗漏了什么，然后花了半个小时乱加了一通，好像是解决了。然后各回各家，过了没几分钟，BApp的负责人又说不行，我就预感到了，这个肯定是个棘手的Bug，只能一步一步排查了。其实这个问题最终也就算是解决了99%，剩下的那1%是因为哪里导致的阻塞，估计还需要花更多的精力解决，至于我们代码里为什么没有出现这个Bug，真的不好解释。 

### 总结： 

* 思维不要先入为主；
* 从源头开始，一步一步追查，不要放掉任何细节；


## 二、dealloc
在BugTags中检测到了几个崩溃，提示： 

> Cannot form weak reference to instance (0x105442000) of class OPCustomWebViewController. It is possible that this object was over-released, or is in the process of deallocation 

看到这个提示也是一脸懵，找到代码一看，是创建weak引用的地方，再来看提示，大概就是在对象dealloc的过程中，执行了    __weak typeof(self) weakself = self;的时候出现了这个错误。 

然后又搜了一下提示，找到了这里https://opensource.apple.com/source/objc4/objc4-646/runtime/objc-weak.mm.auto.html， 

```
if (deallocating) {

   _objc_fatal("Cannot form weak reference to instance (%p) of "
               "class %s. It is possible that this object was "
               "over-released, or is in the process of deallocation.",
               (void*)referent, object_getClassName((id)referent));

}
```

这个是出现崩溃的提示，看变量名大概也就猜到了，dealloc是一个过程，这个过程不能有太耗时的操作，然后回头看我们代码中的dealloc函数中有这么一句 

```
[[NSUserDefaults standardUserDefaults] synchronize];
```

那就是这里了，这个是一个很耗时的操作，相对于其它指令而已，这个函数涉及文件写入，肯定要比其它耗时的多。 

当然，这是一个方面，大多数情况而言，在函数即将释放时，不应该再有其他操作了，在我们出错的这个类包含一个UIWebView，而且还与网页有一定的交互，导致这个崩溃的大概场景可能是因为用户网络比较慢，打开网页特别慢，用户受不了，关闭页面，Controller进入释放过程，因为dealloc的过程比较长，而此时恰好网页打开了，Controller中响应了JS，就产生了上面的问题。如果去掉耗时操作，只能降低这个问题发生的概率，正常解决方式，是应该在用户关闭之后，取消掉与js的交互，同时也不应该把dealloc作为类的收尾工作来使用。 

### 总结： 

出现这个bug是因为在不合适的地方执行了不合适的操作，另外也没有在合适的地方进行合适的操作，最终导致了这么一个奇怪的Bug。


## 三、x86_64
关于x86_64估计大家都很害怕，一般在静态库的时候会出现编译过程中找不到符号的问题，这个不算是Bug，是工程无法编译通过。这个也还是云盘的代码的问题，云盘中用了libmp3lame.a，在模拟器编译过程中提示没有x86_64的符号，然后用lipo -info libmp3lame.a看了一下的的确确是有x86_64的符号，这就很尴尬了。因为这个项目正在由另一个同事清理，在他的电脑上我不方便定位，于是就让他提交了一下代码，我来处理。 

我的第一反应是，可能是他在整理的过程中环境出了什么问题，结果我clone下来的编译也还是一样的错误，我又检查了一遍，确实是包含。 

于是又看了一眼编译警告，突然发现这个库的路径有点问题，因为云盘代码我们作为submodule引入了，肯定不是这个路径，然后定位到库文件，用lipo一看果然不包含x86_64，这就见鬼了。仔细一看原来项目中包含两份云盘代码，出问题的这个代码只在项目仓库里，没有加入到工程中，而且应该更加古老。但是不知道为什么这个静态库会被编译了呢，真的是非常诡异。 

因为Xcode的工程文件是个大黑盒，所以真的是无从查起，怀疑大概是在整理项目的过程中不知道怎么又产生了引用，因为是同名的库，可能在Xcode中体现不出来，最终就导致了这么一个诡异的编译问题。 

### 总结： 

* 警告往往也很有用，所以需要尽可能的清理掉工程中的编译警告；
* 没用的代码尽早彻底删除，不要遗留在项目的角落里；

