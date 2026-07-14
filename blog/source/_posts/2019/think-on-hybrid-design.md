---
title: 混合框架设计思路
date:  2019-04-15 18:52:34
tags:
---
混合框架最核心的目的就是解决H5和原生之间的数据传递、函数调用，在此基础上再为H5提供一些“原生能力”，如拍照、选照片、录音等等。其实拍照、选照片这些H5也是可以做到的，但是无法定制。另外，为了让原生页面和H5页面可以互相跳转，还需要配合路由层。 

基于上述分析，我在把混合框架分为了以下四大块： 

* 数据传递
* 函数调用
* 插件系统
* 路由层



## 1 数据传递

数据传递和函数调用本质是一回事，数据传递也是通过函数调用来获取的，但是这里说的数据，是“固定数据”，例如当前登录的用户信息，App的版本信息等等，这些数据在App的生命周期中通常是不会产生变化的，所以固定数据采取注入浏览器的方式来进行传递。 



## 2 函数调用

函数调用是指Javascript可以调用原生函数，实现简单的函数调用很简单，主要的难点在于函数的返回值如何传递。在Android中是原生函数的返回值是可以直接传递给Javascript，但是在iOS中无法做到，所以为了保证两端的兼容性，函数的返回值统一采用了callback的形式。一般来说，Javascript中的callback是匿名函数，我们是无法在原生代码中直接调用，所以这里做了处理，所有与原生交互的callback都会随机生成一个唯一的callbackId，在Javascript中有一个全局字典以callbackId为key存储了匿名的callback，这样在原生返回数据给Javascript的时候，实际上是调用了Javascript中定义的一个全局函数dispatchCallback ，这个函数的具体实现如下所示： 

```
dispatchCallback : function (callbackId, param) {
 console.log('callbackId: ' + callbackId);
 var callback = this.callbacks[callbackId];
 if (callback) {
   callback(param);
 }
 delete this.callbacks[callbackId];
}
```

为了简化函数调用，最初的设想是抽象出几个核心函数提供给Javascript调用，但在具体实现的时候发现其实只需要一个最核心的函数提供给Javascript即可，其他的函数可以通过调用协议来执行。调用协议的定义如下： 

```
{
   “function”:”goBack”,
   “param” : {},
   “callback": function() {}
}
```

其中：

* **function**就是我们执行的函数；
* **param**是这个函数所需要的参数；
* **callback**是原生执行完函数之后需要执行**callback**来传递数据，在具体代码中，这个**callback**实际存储的是**callbackId**；

所以函数调用最终被抽象成了调用协议，在原生代码中只需要根据function来判断需要执行哪个函数即可，与Javascript做到了最简交互。 

之前提到的核心函数是区别于插件而言的，目前核心函数有以下几个： 

* **openURL**，这个函数用于H5跳转到App实现的页面，也可以从H5直接跳转到H5，也就是路由层的功能。 
* **postMessage**，这个函数可以做到H5和原生之间的轻量级交互，主要是为了应对一些“突发”的、且比较轻量级的交互需求，就不必直接写插件了。 

* **goBack**，我们很多的H5页面是全屏的，用这个函数直接返回上一级页面。 

* **loadPlugin**、**callPlugin**、**unloadPlugin**这个三个函数是操作插件的。 

上面这几个函数最终都是转换成函数调用协议来实现调用原生代码的。 



关于postMessage详细讲一下，这个类似于iOS中的通知，postMessage的数据如下所示：

```
{
 "message":"alert",
 "param":{
   "title":"test"
 }
}
```

在原生代码中，可以通过Hook alert 这个Message，当JavaScript是postMessage发送alert时，就会触发Hook的操作，这样我们就可以直接使用MessageHook来实现与H5的简单交互。在iOS中，Hook示例代码如下：

```
[HybirdMessageHook hookMessage:@"alert" withBlock:^void (NSDictionary * _Nonnull param, NSString * _Nonnull callbackId, XDFHybirdViewController * _Nonnull controller) {
       NSString *txt = param[@"text"];
       UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Javascript" message:txt preferredStyle:UIAlertControllerStyleAlert];
       UIAlertAction* defaultAction = [UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault
                                                             handler:^(UIAlertAction * action) {
                                                                 [controller dispatchCallback:callbackId param:@{@"info":@"good"}];
                                                             }];
       
       [alert addAction:defaultAction];
       [controller presentViewController:alert animated:YES completion:nil];
}];
```

Javascript执行postMessage后，最终会触发Hook该message的block，这样就完成一个非常轻量级的交互操作。

## 3 插件系统

插件系统一方面是为了保持核心调用的精简化，一方面可以通过插件的方式将工作很好的分摊出去。而且，插件实现的功能不是每个H5都需要的功能。有了插件系统，我们就能保证核心Javascript的长期稳定。 

插件的本质也是函数调用，只不过插件的函数调用是通过核心函数callPlugin实现的，所以插件的调用也是采用的调用协议，定义如下： 

```
{
   "plugin":pluginName,
   "function":pluginFunctionName,
   "param":pluginParam
}
```

插件的调用协议跟函数调用协议是一样的，只是复用了函数调用的callback，而且，插件协议是包含在函数调用协议之中的，所以一个插件调用的完成协议应该是这样的： 

```
{
   “function”:”callPlugin”,
   “param” :{ 
       "plugin":pluginName,
       "function":pluginFunctionName,
"param”:{} 
   },
   “callback": function() {} 
}
```

这里稍微有点绕，而且我自己在具体实现功能的时候也被绕进去了。但是为了保证协议的简单性，也没有太好的改进方式。 

在原生方面，所有的插件都需要继承自HybirdPlugin，其定义如下： 

```
@interface HybirdPlugin : NSObject

@property (nonatomic, strong) NSString *name;               // 插件名
@property (nonatomic, strong) NSString *version;            // 版本
@property (nonatomic, weak) WKWebView *webView;           // 当前webView
@property (nonatomic, weak) HybirdViewController *controller; // webView所在的Controoler

- (instancetype)initWithParam:(NSDictionary *)param;
- (void)onLoad;
- (void)unLoad;
- (void)onMessage:(NSDictionary *)message callbackId:(NSString *)callbackId;

@end
```

在安卓中采用了抽象类，定义如下： 

```
public abstract class HybirdPlugin {
   public String name;
   public String version;

   public WebView webView;
   public HybirdActivity activity;
   public Context context;

   public JSONObject param;
   public abstract void setContext(Context context);
   public abstract void onload();
   public abstract void unload();
   public abstract void onMessage(JSONObject message, String callbackId) throws JSONException, Exception;
}
```

其中onLoad和unLoad是插件的生命周期，实现的插件中，还没有太多需要关注生命周期的。 

onMessage是与H5交互的关键函数，插件调用协议和callbackId就是onMessage所需要参数，一个简单的onMessage实现如下所示： 

```
- (void)onMessage:(NSDictionary *)message callbackId:(NSString *)callbackId {
   @try {
       NSLog(@"Messge:%@ \r\n CalbackId:%@", message, callbackId);
       NSString *function = message[@"function"];
       NSDictionary *param = message[@"param"];
       if ([function isEqualToString:@"set"]) {
           NSString *content = param[@"content"];
           if (content.length > 0) {
               UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
               pasteboard.string = content;
           }
       }
       else if ([function isEqualToString:@"get"]) {
           NSString *content = @"";
           UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
           if (pasteboard.string.length > 0) {
               content = pasteboard.string;
               NSDictionary *param = @{@"content": content};
               [self.controller dispatchCallback:callbackId param:param];
           }
       }
   } @catch (NSException *exception) {
       NSLog(@"onMessage failed: %@", exception);
   }
}
```

所以插件实现起来也相当简单，几乎就是核心函数的翻版，两者保持了高度一致。 

目前插件系统的局限性是在与H5之间的文件操作上，因为H5无法直接操作本地文件，所以“大数据”的传递是个问题。比如，照片、录音等等，但这些又是H5迫切需要的功能。现在是通过将文件进行base64编码后直接传递给H5，而且，后来我发现H5直接选择相册中的图片后，通过FileReader来展示到网页上也是通过将图片base64编码后直接展示的，所以问题应该不大。 

## 4 路由层

路由层的职责很明确，就是实现H5与原生、H5与H5之间的跳转，当然也包括原生与原生之间的跳转。开源的路由很多，但是考虑到我们对路由的要求就是实现跳转，所以就实现了一个“极简”路由，本质就是建立了一个uri与原生Viewcontroller的一一对应关系。现在来看路由层是稍微简单了一些，目前主要的问题在于对于旧页面的兼容性，兼容性问题很难找到一个好的解决方案，现在的做法可能会为旧页面做一个中间页面，路由层直接跳转到中间页面，再由中间页面跳转到旧页面。 

路由层还有一个特殊用法，路由表可以由服务端下发，这样就可以轻易的在服务端控制App的页面切换，而且我们也实现了原生和H5之间的无缝跳转，所以一旦某个原生页面产生了严重Bug，我们可以快速赶制替换原生的H5页面，通过调整路由表来做到热更新。当然，目前这个用法只是一个可能性用法，还没有落地。 

## 5 总结

上面的四大块是我在设计混合框架时候的总的思路，用协议代替了具体函数实现，用核心函数来实现原生与H5的核心交互，用插件系统来为H5提供原生能力，用路由实现原生与H5、H5与H5之间的无缝跳转，自我感觉良好，核心思路应该是没有什么问题的，最终交给时间来检验吧。 

但是在具体的实现中还有很多边边角角需要我们考虑。核心函数也好，插件也好主要是为H5提供与原生交互的功能，但是如果原生需要主动触发H5呢？现在我的做法是定义了几个固定的函数，比如window.onAppNotification函数，这个函数用于原生向H5发送通知，如果当前的页面需要监听某个通知，那就在页面加载完成之为window对象增加一个函数： 

```
window.onAppNotification = function(data) {
 var notification = data['notification'];
 var param = data['param'];
 if (notification == 'test') {
   console.log('count=', param);
   document.getElementById('info').innerText = param;
 }
}
```

目前混合框架遗留的最大问题就是没有完整的实现双向通信，现在基本上还是由H5主动发起的通信，这个是将来需要重点解决的问题，但应该比较困难主要。 

本文主要描述了框架的整体设计思路，对于性能、缓存等还未考虑，但是这两方面对于用户体验来说至关重要，尤其是缓存。H5的主要问题是相对于原生页面来说加载慢一些，但是如果能够很好的做到"动静"分离以及缓存，只要不是带有过于复杂交互的UI，H5应该是能够满足性能要求的。

H5的兼容性也是需要考虑的，特别是对刘海屏的适配也需要在框架之中考虑，总之混合框架的整体设计没有什么技术难点，但在于具体的应用当中还是需要经过一段时间的沉淀才能做好。

