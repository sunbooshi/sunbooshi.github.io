---
title: 批量化的项目代码分析脚本及配置工具
date: 2018-03-29 14:04:26
tags:
---
在上一篇[《使用Jenkins+OCLint+SonarCube对iOS项目进行代码分析》](https://www.jianshu.com/p/bfb266de23f1)提到了如果需要批量的将项目接入代码分析也是个体力活，而且还容易出错。另外，上一篇主要目的是将各个环节串联起来，也没有介绍OCLint的相关配置。

在上一篇中我们之间通过命令行向OCLint传递参数，除此之外OCLint还支持使用[配置文件](http://docs.oclint.org/en/stable/howto/rcfile.html)。具体做法就是在当前目录下`.oclint`文件，将配置项写入该文件。一个简单的配置文件内容如下：

```
rule-configurations:
  - key: LONG_LINE
    value: 1000
  - key: LONG_METHOD
    value: 200
  - key: CYCLOMATIC_COMPLEXITY
    value: 10

disable-rules:
  - UnusedMethodParameter
  - AssignIvarOutsideAccessors
  - ShortVariableName

report-type: pmd
output: oclint.xml
max-priority-1: 10000
max-priority-2: 10000
max-priority-3: 10000
```

上面`.oclint`示例中主要是规则参数的调整以及规则禁用，比如我们把函数最大长度改为了200，默认值是100。另外与OC比较密切相关还有一个LONG_VARIABLE_NAME，变量名最大长度，按照OC冗长的命名规则来说，默认值20小点了，改为40可能比较合适，当然这个还是具体的根据自己公司的代码规范执行。

除了`.oclint`，还有`sonar-project.properties`文件也需要生成，所以，现在就是收集项目信息，根据实际情况调整OCLint规则，生成`.oclint`以及`sonar-project.properties`。

根据上一篇的内容，有了基本的配置信息，写一个脚本来适配所有项目最合适不过了。脚本需要实现三个主要功能，编译工程生成compile_commands.json，调用oclint生成oclint.xml，使用sonar-scanner生成分析报告。然后就是配置文件生成，因为需要一定交互，用vue.js来实现比较不错（之前还做了Chrome App，但是最新的Chrome已经放弃Chrome App了，比较遗憾，只能本地起服务或者部署到服务器上了）。

先来一个截图看看：

![sonar-maker](/images/sonar-maker.png)

通过配置工具可以生成一个json文件，然后将该文件传递给python脚本就可以实现项目代码分析了。这样在上一篇文章中的`2.2）`其中构建一步的shell脚本只需要输入如下内容即可：

```
/Users/drsun/jenkins/jenkins-sonar.py /Users/drsun/jenkins/afnetworking.json
```

是不是清爽了很多？

本篇提供的工具不算太完善，还需要根据自己的情况去调整。

项目代码：https://github.com/sunboshi/sonarmaker
