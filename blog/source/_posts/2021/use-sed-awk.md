---
title: 用好awk&sed隔离危险代码操作
date:  2021-10-27 10:43:26
tags:
---

最近有一个需求，期望在打包的时候注释掉一些代码，修改App的行为。因为这些修改会影响App的正常使用，所以需要特别注意不能带到线上。比较好的方式是直接改打包脚本，新建打包任务，通过脚步来完成代码注释，只有这个打包任务才会修改App修为，这样就可以完全隔离危险操作了。



要想通过脚本来改文件，最好的选择就是awk和sed了，这俩是神器，还有专门的书介绍。不过，在客户端开发的实际工作中真的挺难找到使用场景的，所以这次专门写文章记录一下。



本次需求是找到指定函数，然后直接把函数实现注释掉，只保留一个空函数。思路是通过awk匹配函数名，来找到函数的起始行**FuncStart**，然后通过匹配大括号“}”，来找到函数结束**FuncEnd**。最后通过**sed**来把**FuncStart**与**FuncEnd**的之间的代码加上“//”注释掉。



思路很清晰，举个简单的例子，比如我们想把**AFNetworking**的**AFHTTPSessionManager**中的[encodeWithCoder](https://github.com/AFNetworking/AFNetworking/blob/4.0.0/AFNetworking/AFHTTPSessionManager.m#L332)实现给注释掉。



首先使用**awk**找到**encodeWithCoder**所在的行：

```
awk '/\(void\)encodeWithCoder/ {print NR}' AFHTTPSessionManager.m
```

上面的命令会输出`332`。



然后来找到函数结束，这里有个问题，所有函数的都是以“}”结尾，我们需要从**encodeWithCoder**所在的行开始找到第一个以“}”开始的行，改行就是函数结束，然后退出awk循环，命令如下：

```
awk '/^\}/ {if(NR>332){print NR;exit}}' AFHTTPSessionManager.m
```

上面的命令会输出`344`。



有了函数起始`332`和结束`344`之后，就是用sed来在333和343行起始加上“//”，命令如下：


```
sed "333,343s/^/\/\//" AFHTTPSessionManager.m
```


然后我们得把上面的三条命令给串起来，需要把第一条命令的输出给到第二条命令，这里面就涉及一个知识，在把shell中的变量传递给awk，原本在shell中传递参数很简单，直接$var就行，但是用awk有点特殊，得按下面的写法：

```
awk -v line=$FuncStart '/^}/ {if(NR>line){print NR; exit}}' AFHTTPSessionManager.m
```


这里通过-v命令，把FuncStart赋值给awk中的line变量，这样才能在awk中使用。但是如果传给sed就比较简单了，完整的脚本如下：

```
FuncStart=`awk '/\(void\)encodeWithCoder/ {print NR}' AFHTTPSessionManager.m`
((FuncStart++))

FuncEnd=`awk -v line=$FuncStart '/^}/ {if(NR>line){print NR; exit}}' AFHTTPSessionManager.m`
((FuncEnd--))

sed -i "" "${FuncStart},${FuncEnd}s/^/\/\//" AFHTTPSessionManager.m
```


这里使用了-i ""命令把修改回写到文件，**注意这是Mac下awk比较特殊的地方，-i表示备份文件的扩展名，传空表示不创建备份文件**。



目前为止，很完美！但如果我们要改多个文件的话，就需要每个函数这么来一遍，得写成函数才行，文件名和函数名作为参数。函数如下：



```
Patch() {
    FuncStart=`awk -v pattern="$2" '$0 ~ pattern {print NR}' $1`
    ((FuncStart++))

    FuncEnd=`awk -v line=$FuncStart '/^}/ {if(NR>line){print NR; exit}}' $1`
    ((FuncEnd--))

    sed  -i '' "${FuncStart},${FuncEnd}s/^/\/\//" $1
}

Patch AFHTTPSessionManager.m "\(void\)encodeWithCoder"

```

看起来不错，不过运行的时候会发现awk在匹配函数起始的时候没有返回，这是因为我们通过-v来传递的变量不能有特殊符号，比如转义符合，😂

只能通过环境变量来传递，如下：

```
FuncStart=`PATTERN=$2 awk '$0 ~ ENVIRON["PATTERN"] {print NR}' $1`
```


再加一点判断，确保当文件发生变动匹配不到的时候报错，最终的脚本如下：



```
#!/bin/bash
set -e

Patch() {
    FuncStart=`PATTERN=$2 awk '$0 ~ ENVIRON["PATTERN"] {print NR}' $1`
    if [ -z "$FuncStart" ]; then
        echo "[ERR] not found '$2' in $1"
        exit 1
    fi
    ((FuncStart++))

    FuncEnd=`awk -v line=$FuncStart '/^}/ {if(NR>line){print NR; exit}}' $1`
    if [ -z "$FuncEnd" ]; then
        echo "[ERR] not found '}' in $1"
        exit 1
    fi
    ((FuncEnd--))

    echo "comment line ${FuncStart},${FuncEnd} in $1"
    sed  -i '' "${FuncStart},${FuncEnd}s/^/\/\//" $1
}

Patch AFHTTPSessionManager.m "\(void\)encodeWithCoder"
```

这样，就可以愉快的使用脚本来改代码而不用担心带入线上了！
