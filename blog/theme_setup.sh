#!/bin/bash

git clone https://github.com/xbmlz/hexo-theme-maple.git themes/maple
cd themes/maple
git checkout 2020a22539efe8dbeb906f0fc5f80ed1699ad2f8

cp ../../theme_config.yml _config.yml