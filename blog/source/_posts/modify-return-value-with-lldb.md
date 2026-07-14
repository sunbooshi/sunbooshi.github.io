---
title: 【Tricks】使用lldb修改函数返回值
date: 2018-06-27 10:15:12
tags:
---
在调试程序的过程中，经常会遇到某个if-else逻辑中依赖一个函数的返回值，而不巧的是这个返回值不是我们期望的值，那只能再来一遍。其实有个偷懒的办法，可以用lldb来修改函数的返回值。下面就让我们了解一下比runtime更加黑科技的lldb大法。

我写了三个简单的函数分别返回BOOL、int和NSString来实际讲解一下原理和操作方式。代码如下所示：

调用代码如下所示：
```
- (BOOL)isGood:(int)n {
    if (n > 10) return YES;
    return NO;
}

- (int)inc:(int)n {
    int result = n + 1;
    return result;
}

- (NSString *)toString:(int)n {
    NSString *result = [NSString stringWithFormat:@"sunboshi.tech%d", n];
    return result;
}
```
调用代码如下所示：
```
if ([self isGood:5]) {
    NSLog(@"good");
}
else {
    NSLog(@"bad");
}

if ([self inc: 6] > 10) {
    NSLog(@"good");
}
else {
    NSLog(@"bad");
}

if ([[self toString:6] isEqualToString:@"sunboshi.tech7"]) {
    NSLog(@"good");
}
else {
    NSLog(@"bad");
}
```

在工程中按照如下图所示设置好断点：
![](/images/2018/lldb01.jfif)

然后运行工程，当执行到isGood函数时，点击Debug->Debug Workflow->Always Show Disassembly，这时会显示isGood函数的汇编代码如下所示：
![](/images/2018/lldb02.jfif)

看不太懂，不要紧。这时我们按F8键，也就是Debug菜单下的Step Out，注意左下角的变量窗口，可以看到最顶上有一个“Return Value”显示的是NO，如下图所示：
![](/images/2018/lldb03.jfif)

然后，我们将上面的两张图对比一下，注意第二张光标所在的位置以及第一图14行，是不是有什么发现，好像都是在操作寄存器al，另外我在命令行窗口输入了`register read rax`，这个命令读取了rax寄存器的值，al也好、eax也好、rax也好其实是一码事，是表示一个64位数中的不同位，它们的关系如下：

```
rax,eax,ax,ah,al 关系
|63..32|31..16|15-8|7-0|
               |AH.|AL.|
               |AX.....|
       |EAX............|
|RAX...................|
```

需要说明的是，项目是在模拟器里面执行的，是x86的架构体系，在x86下，函数的返回值是保存在`rax（eax）`寄存器中，所以如果需要修改函数的返回值，只要直接修改rax的值就行了，使用如下命令将rax改为1，也就是YES。

```
register write rax 1
```

这时候再继续执行程序，是不是神奇的事情发生了，流程被我们改变了。

接下来再来看函数返回整数是个什么情况：
![](/images/2018/lldb04.jfif)

可以看到rax里存储的直接就是整数值，同样的可以直接使用`register write rax`将rax修改成期望值。

如果函数返回的是NSString就有点繁琐了
![](/images/2018/lldb05.jfif)

此时，rax中存放是指针，我们不能像之前那样直接修改rax了，这时候需要使用p命令来重新生成一个字符串，然后将这个字符串的地址写入rax，如下图所示：
![](/images/2018/lldb06.jfif)

稍微绕了一下，但是还是可以修改的。之前特别说明了上面的这些操作是在模拟器下执行的，如果在真机上是arm体系，来稍微看一眼汇编代码：
![](/images/2018/lldb07.jfif)
![](/images/2018/lldb08.jfif)

差别大不大不太了解，反正是看不懂。不要紧，只要知道arm下的函数返回值是存在x0寄存器，使用`register write x0 1`就可以了，所以在arm下我们只要把上面使用的rax换成x0寄存器就可以。

需要说明一下，在lldb中register可以简写成reg，又可以少输入几个字符。简单总结一下就是在不管是在x86还是arm架构下，函数的返回值都是存在寄存器中，x86是在rax寄存器中，arm是在x0寄存器中，我们利用Xcode的F8快捷键，将程序暂停在函数执行结束后的指令，然后利用`register write`来修改寄存器值从而达到修改函数返回值的目的。

特别是在某些依赖服务端数据的时候，我们想要调整逻辑就需要在代码里写死一些数据来保证逻辑按照我们预期的执行，这样做的弊端就是逻辑调完之后忘记把死数据给去掉了，很尴尬，这时候用lldb就相当受用了。结合Xcode中在断点中执行lldb指令的功能，简直可以随心所欲的修改程序了。比如我们想要isGood函数总是返回YES，右键点击断点的蓝色标志选择*Edit Breakpoint…*，点击*Add Action*增加一条*Debugger Commander*，*thread return 1*，如下图所示：
![](/images/2018/lldb09.jfif)

这是告诉lldb，执行到该断点时直接退出函数，并且返回1。注意勾选*Automatically continue after evaluating actions*，这样修改完函数返回值后就会继续执行流程，不会停在断点处，可以根据实际情况选择是否需要。

而对于toString函数我们希望它总是返回*sunboshi.tech7*，*Debugger Commander*中输入如下内容即可：

```
thread return [NSString stringWithString:@"sunboshi.tech7"]
```

![](/images/2018/lldb10.jfif)
