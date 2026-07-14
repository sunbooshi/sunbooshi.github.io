---
title: 使用Jenkins+OCLint+SonarCube对iOS项目进行代码分析
date: 2018-03-27 10:50:01
tags:
---

大致的流程是使用Jenkins来进行持续构建，执行OCLint来进行代码分析，然后将OCLint生成的分析报告传给SonarCube来对项目代码进行持续的分析。对于项目构建可以采取Git提交触发或者是定时任务的方式。这里面的主要问题是：

1. 这是个分散的系统，各个环节相互依赖，每个环节都可能出错；
2. Jenkins的构建环境比较特殊，与我们直接用命令行操作是有差异的；
3. SonarCube支持Objective-c的插件是收费的，开源插件对最新OCLint的支持不太够；
4. 注意软件版本、资料的时效性（Xcode版本需要特别注意）；

在我们搭建的过程中遇到的问题基本上属于上面三个方面，如果遇到了本文中未出现的问题，尝试从上面几个方面入手分析。为了更好的理解整个流程，最后会采用一个开源项目进行代码分析。

阅读说明：本篇内容步骤较为繁琐，大概分为三部分内容Jenkins安装、SonarCube安装、以及OCLint安装。其中OCLint是核心部分，而这部分最为繁琐，一定要注意路径、环境变量等细节设置。



## 〇、基础环境准备

因为部分软件是直接解压使用的，为了确保环境一致，我们现在用户目录下建立一个**jenkins**目录，将所有解压使用的软件放在该目录下。在终端命令行中使用如下命令建立目录：

```
cd ~
mkdir jenkins
```

使用如下命令获取jenkins目录的完整路径：

```bash
cd ~/jenkins
pwd
# 我本机的路径是 /Users/drsun/jenkins
```

**注意保存该路径，接下来会频繁使用该路径。**



## 一、Jenkins安装

**版本 ：2.89.4**

**下载地址：https://jenkins.io/download/**

推荐直接使用dmg安装包，双击安装即可，安装后的一些调整（如http端口、卸载等）可以参考[这里](https://wiki.jenkins.io/display/JENKINS/Thanks+for+using+OSX+Installer)。

这个版本Jenkins的插件服务器启用了https，安装过程中会出现如下提示：

> This Jenkins instance appears to be offline

解决的方式是将`hudson.model.UpdateCenter.xml`文件中的https改为http，在Mac系统下该文件位于`/Users/Shared/Jenkins/Home/hudson.model.UpdateCenter.xml`。（注意需要使用**sudo**权限修改）

修改完成后，执行如下命令重启Jenkins服务：

```
sudo launchctl unload /Library/LaunchDaemons/org.jenkins-ci.plist
sudo launchctl load /Library/LaunchDaemons/org.jenkins-ci.plist
```

重启完成后，继续完成Jenkins配置，插件安装直接默认安装即可，注意一定要安装`Git插件`，如下图所示：

![Git插件](/images/jenkins_02.png)

Jenkins服务默认的监听端口是8080，这个端口比较常用，可以通过如下命令来调整端口，避免与其它服务冲突。

```
sudo defaults write /Library/Preferences/org.jenkins-ci httpsPort 8100
```

这里我们将Jenkins的端口改为了8100，使用之前的命令**重启Jenkins服务**，接下来就可以使用http://localhost:8100 来访问Jenkins了。



## 二、SonarCube安装

**版本 ：6.7.2**

**下载地址：https://www.sonarqube.org/downloads/**

由于Objective-c分析插件不支持最新的7.0版本，所以只能使用6.7版本的SonarCube。SonarCube的安装比较简单，直接解压到之前的jekins目录即可。使用如下命令启动SonarCube：

```
~/jenkins/sonarqube-6.7.2/bin/macosx-universal-64/sonar.sh
```

启动之后，可以通过http://localhost:9000/来访问SonarCube。SonarCube的配置不多，如果需要在生产环境中使用，需要再配置数据库连接，这里我们使用内置的数据库来跑通流程。

从[这里](https://github.com/Backelite/sonar-objective-c/releases)下载SonarCube的Objective-c插件（版本：0.6.2），将jar文件拷贝到`~/jenkins/sonarqube-6.7.2/extensions/plugins`目录下，通过`Administration->System->System Info->RestartServer`重新启动SonarCube。之后可以通过`Administration->System->Update Center->Installed`查看安装好的Objective-c插件，如下图所示：

![Objective-c插件](/images/jenkins_03.png)



## 三、OCLint安装

这一步中需要安装三个软件，其中xcpretty就将xcodebuild的输出转化为oclint所需要的json文件，然后使用oclint附带的oclint-json-compilation-database命令对项目进行分析生成分析报告，最后通过SonarScanner将分析报告发送至SonarCube完成一个完整的分析过程。



### 1. 安装OCLint（版本：0.13.1）

从[这里](https://github.com/oclint/oclint/releases)下载，将`oclint-0.13.1-x86_64-darwin-17.4.0.tar.gz` 解压至`~/jenkins`目录。

### 2. 安装xcpretty（版本：0.28)

使用如下命令安装xcpretty：

```
sudo gem install xcpretty
```

安装完成后使用如下命令检查版本：

```
xcpretty -v
```

### 3. 安装SonarScanner（版本：3.0.3.778）

从[这里](https://docs.sonarqube.org/display/SCAN/Analyzing+with+SonarQube+Scanner)下载安装包，将安装包解压至`~/jenkins`目录。

### 4. 设置PATH变量

因为我们需要从终端直接执行oclint等，所以需要将它们添加至PATH变量，如果你使用的是bash（一般默认的都是bash），通过如下命令设置PATH，并使其生效（**注意如下命令中的路径，将drsun修改为你的用户名，该路径也就是我们在第〇步强调的路径**）

```
echo "export PATH=$PATH:/Users/drsun/jenkins/oclint-0.13.1/bin" >> ~/.bashrc
echo "export PATH=$PATH:/Users/drsun/jenkins/sonar-scanner-3.0.3.778-macosx/bin" >> ~/.bashrc
source ~/.bashrc
```



## 四、创建分析项目

#### 1. 手动执行

在第三步中已经安装好了所需要的软件，并且也设置好了PATH，此时可以通过终端来手动生成一个项目分析报告，为接下来在Jenkins中进行持续分析准备。这里我们以**AFNetworking**的代码为例来进行分析，以下操作均在AFNetworking源代码目录下执行。另外注意Xcode的版本，我用的版本是**Version 9.2 (9C40b)**，如果你的版本不一致，请先阅读完**1.6）**之后再来执行各个步骤。

##### 1.1）清理工程

```
xcodebuild -workspace AFNetworking.xcworkspace -scheme AFNetworking\ iOS -sdk iphonesimulator11.2 -configuration Debug clean
```

##### 1.2）生成compile_commands.json

```
xcodebuild -workspace AFNetworking.xcworkspace -scheme AFNetworking\ iOS -sdk iphonesimulator11.2 -configuration Debug COMPILER_INDEX_STORE_ENABLE=NO | xcpretty -r json-compilation-database -o compile_commands.json
```

##### 1.3）生成oclint.xml

```
oclint-json-compilation-database -- -report-type pmd -o oclint.xml -max-priority-1 100000  -max-priority-2 100000  -max-priority-3 100000
```

##### 1.4）处理oclint.xml

oclint生成的报告中如下形式的规则会导致Objective-c分析插件出错（**ERROR: The rule 'OCLint:compiler warning' does not exist.**），

```xml
<violation begincolumn="24" endcolumn="0" beginline="90" endline="0" priority="2" rule="compiler warning" ruleset="clang">
implicit conversion loses integer precision: 'NSInteger' (aka 'long') to 'int'
</violation>
```

这些规则一般是编译警告，正常来说在工程中是应该消除编译警告的，但是对于一些历史项目来说可能是不现实的。Objective-c分析插件没有将这些编译警告转化为对应的规则，可以使用如下python脚本将`oclint.xml`中的这些规则删除掉，脚本的处理方式比较简单粗暴，直接将所有ruleset是clang的XML节点全部删掉了。

```python
#!/usr/bin/python

import xml.etree.ElementTree as ET
import os

os.system('mv oclint.xml oclint.xml.origin')
tree = ET.ElementTree(file='oclint.xml.origin')
root = tree.getroot()
del_items = []
for child in root:
    for one in child:
        if one.attrib['ruleset'] == 'clang':
            print child.attrib['name']
            del_items.append(child)
            break

for del_item in del_items:
    root.remove(del_item)

tree.write('oclint.xml')
```

将上述代码保存到 `~/jenkins`目录下，命名为`rm_clang.py`，使用如下命令处理`oclint.xml`。

```
python ~/jenkins/rm_clang.py
```

> 注意：AFNetworking的代码实际上不需要这样处理！



##### 1.5）生成Sonar报告

将如下内容保存为`sonar-project.properties`文件，放到AFNetworking目录下。

```
sonar.projectKey=AFNetworking
sonar.host.url=http://localhost:9000
sonar.login=admin
sonar.password=admin

sonar.language=objc
sonar.objectivec.workspace=AFNetworking.xcworkspace
sonar.objectivec.appScheme=AFNetworking iOS
sonar.sources=AFNetworking

sonar.objectivec.oclint.report=oclint.xml
```

上述文件中，第一部分是SonarCube相关的配置，主要是sonar.host、sonar.login、sonar.password这几项需要根据自己的情况修改，另外不需要专门在SonarCube创建项目，如果项目不存在SonarScanner会自动创建。

第二部分是Xcode工程相关的配置，根据项目实际情况填写即可。

第三部分是oclint生成的分析报告。

执行如下命令即可在SonarCube中查看分析报告：

```
sonar-scanner
```

命令执成功之后可以看到这样的输出

```
INFO: Analysis report generated in 268ms, dir size=390 KB
INFO: Analysis reports compressed in 105ms, zip size=106 KB
INFO: Analysis report uploaded in 199ms
INFO: ANALYSIS SUCCESSFUL, you can browse http://localhost:9000/dashboard/index/AFNetworking
INFO: Note that you will be able to access the updated dashboard once the server has processed the submitted analysis report
INFO: More about the report processing at http://localhost:9000/api/ce/task?id=AWIeTscSMwxcUMvSI7Pm
INFO: Task total time: 8.012 s
INFO: ------------------------------------------------------------------------
INFO: EXECUTION SUCCESS
INFO: ------------------------------------------------------------------------
INFO: Total time: 9.999s
INFO: Final Memory: 47M/335M
INFO: ------------------------------------------------------------------------
```

直接在浏览器中打开上面的链接就可以看分析报告了。

##### 1.6）命令说明

之前的几个步骤中使用的命令中有一堆参数，在这里简单的说明一下。xcodebuild命令中主要用了`-workspace` 、`-scheme` 、`-configuration`、`-sdk` ，这些参数怎么来的呢？其中`-sdk` 参数我们可以通过如下命令获得：

```bash
xcodebuild -showsdks

#输出如下所示
iOS SDKs:
	iOS 11.2                      	-sdk iphoneos11.2

iOS Simulator SDKs:
	Simulator - iOS 11.2          	-sdk iphonesimulator11.2

macOS SDKs:
	macOS 10.13                   	-sdk macosx10.13

tvOS SDKs:
	tvOS 11.2                     	-sdk appletvos11.2

tvOS Simulator SDKs:
	Simulator - tvOS 11.2         	-sdk appletvsimulator11.2

watchOS SDKs:
	watchOS 4.2                   	-sdk watchos4.2

watchOS Simulator SDKs:
	Simulator - watchOS 4.2       	-sdk watchsimulator4.2
```

所以，可以确定`-sdk iphonesimulator11.2`参数。

其它几个参数可以通过如下命令获得：

```bash
xcodebuild -list
#输出如下所示
Information about project "AFNetworking":
    Targets:
        AFNetworking iOS
        AFNetworking watchOS
        AFNetworking OS X
        AFNetworking tvOS
        AFNetworking iOS Tests
        AFNetworking Mac OS X Tests
        AFNetworking tvOS Tests

    Build Configurations:
        Debug
        Release

    If no build configuration is specified and -scheme is not passed then "Release" is used.

    Schemes:
        AFNetworking iOS
        AFNetworking OS X
        AFNetworking tvOS
        AFNetworking watchOS
```

根据我们需要分析的内容选择对应的参数即可。

关于oclint-json-compilation-database命令需要特别说明的是，该命令最终会调用oclint命令，所以在**1.3）**步骤中 `--`（双横线）之后的参数实际上是传递给oclint的。而对于oclint-json-compilation-database命令需要特别注意的是`-e`参数，该参数可以帮助我们排除不需要进行分析的第三方代码，比如使用了cocoapods之后，就需要使用如下命令来将Pods目录排除。

```
oclint-json-compilation-database -e Pods -- -report-type pmd -o oclint.xml -max-priority-1 100000  -max-priority-2 100000  -max-priority-3 100000
```

这个参数不需要特别的区分目录的路径，只要目录名即可。如果使用的pod库较多，而使用oclint的时候没有排除的话可能导致oclint要处理的文件太多，而最终生成的`oclint.xml`不完整。

另外还需要特别说明的是，如果项目比较大oclint-json-compilation-database执行的时间会比较长，十几分钟以上是正常的。

在oclint分析过程中可能会出现各种问题，我遇到两个比较棘手的问题，一是"error: one compiler command contains multiple jobs”，另一个是“cannot open report file”。

关于第一个，最终确认是pod的问题，需要在xcodebuild中加入COMPILER_INDEX_STORE_ENABLE=NO。或者在工程中配置也行，但直接在命令行中加入比较方便。在上面的命令中我已经加入了。

关于第二个问题，真是百思不得其解，最终通过输出重定向生成了report，打开发现许多文件没有分析，原因是cannot reading file，然后提示too many opened files。一开始没有意识到，后来突然想明白了，这是oclint处理的文件太多了，需要通过-e参数来排除一些不需要分析的库文件来减轻oclint的负担。

出现第二个问题的时候，还有一个情况可能是需要清理一下整个项目的代码，来重新执行分析来解决。

### 2. 在Jenkins中执行

其实上一步中的各种命令就是我们需要用Jenkins自动执行的，在手动完成一次分析报告后，使用Jenkins自动构建就非常的简单了，出了问题也很容易检查。

因为在文章开头，就已经提过Jenkins的构建环境跟手动执行的环境是不一样的。因为Jenkins在Mac系统下创建了一个名为Jenkins的用户，所有构建操作是以该用户执行的，因此环境上是有差异的。

##### 2.1）配置环境变量

先通过`系统管理->系统设置->全局属性`来配置环境变量，如下图所示：

![环境变量](/images/jenkins_04.png)

增加键`LC_ALL`值`en_US.UTF-8`，这个是为了解决xcpretty无法处理中文字符的问题。

增加键`Path`值`/Users/drusun/jenkins/oclint-0.13.1/bin:/Users/drusun/jenkins/sonar-scanner-3.0.3.778-macosx/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:`，这一步等同于第三步中的设置PATH变量，同样需要修改路径为你机器上的路径。

增加键`PYTHONIOENCODING`值`utf-8`，这个是为了解决`rm_clang.py`脚本无法处理包含中文字符的问题。

##### 2.2）创建项目

![创建项目](/images/jenkins_05.png)

如图所示，新建一个`构建一个自由风格的软件项目`任务。然后，在源码管理中选择Git，如下图所示，将AFNetworking的仓库地址https://github.com/AFNetworking/AFNetworking.git填入。

![Git仓库](/images/jenkins_06.png)

在`构建`中选择`增加构建步骤->Execute shell`，如下所示：

![构建步骤](/images/jenkins_07.png)

内容如下：

```bash
xcodebuild -workspace AFNetworking.xcworkspace -scheme AFNetworking\ iOS -sdk iphonesimulator11.2 -configuration Debug clean
xcodebuild -workspace AFNetworking.xcworkspace -scheme AFNetworking\ iOS -sdk iphonesimulator11.2 -configuration Debug COMPILER_INDEX_STORE_ENABLE=NO | xcpretty -r json-compilation-database -o compile_commands.json
oclint-json-compilation-database -- -report-type pmd -o oclint.xml -max-priority-1 100000  -max-priority-2 100000  -max-priority-3 100000
python /Users/drsun/jenkins/rm_clang.py
cp /Users/drsun/jenkins/sonar-project.properties .
sonar-scanner
rm oclint.xml oclint.xml.origin sonar-project.properties compile_commands.json
```

上面的脚本内容就是在上一步手动执行中输入的命令，点击保存后，再点击左侧的`立即构建`进行项目构建。

在真实的项目中，我们可能需要每天半夜1点的时候进行一次构建，这时可以通过`构建触发器->Build periodically`来设置，如下所示：

![定时任务](/images/jenkins_08.png)



## 五、总结

至此，我们已经可以用Jenkins+OCLint+SonarCube来进行iOS项目的代码分析了。在这篇文章里Jenkins的作用好像小了一点，但在具体的项目中可能还会使用Jenkins来自动打包，做每日构建等，这时候在增加一个构建后操作，将本文中的代码分析结合进去。另外，OCLint还可以对一些规则进行设置来满足项目规范，具体可以参考官方文档。

如果公司内部需要接入多个项目的话，每个项目输入一堆命令就有点繁琐了，而且每个项目的负责人也可能不同，所以为了减轻负担，并且能够快速的将项目接入SonarCube，我用Vue做了一个简单的配置页面，可以减轻一些工作量。关于这个配置页面，我会在写一篇简单讲解一下。
