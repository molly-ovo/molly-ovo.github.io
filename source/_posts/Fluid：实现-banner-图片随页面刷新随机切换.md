---
title: Fluid：实现 banner 图片随页面刷新而切换
date: 2026-04-11 15:04:27
tags:
  - Fluid
  - Hexo
categories:
  - 折腾日志
  - 随机banner
excerpt: 通过 Node.js 脚本修改 HTML 渲染逻辑，使浏览器在每次加载页面时实时随机选择图片，个人称之为“暴力注入式修改”
---

#  random-banner的实现

通过 Node.js 脚本修改 HTML 渲染逻辑，使浏览器在每次加载页面时实时随机选择图片，个人称之为“暴力注入式修改”。

## 实现原理

代码使用 Hexo 的 `after_render:html` 过滤器。该功能在 Markdown 转化为 HTML 后介入，通过修改 HTML 字符串，在 `</body>` 标签前插入一段 JavaScript 脚本。

该脚本会执行以下操作：

1. 扫描本地 `source/img/random/` 目录下的图片文件。
2. 将图片路径数组传递给前端 JavaScript。
3. 前端脚本在页面加载时，通过 `Math.random()` 选取一张图片，并强制修改 CSS 背景属性。

## 准备工作

**图片存放目录：img/random/**

支持图片格式：png, jpg, jpeg, gif, svg, webp

**主题配置文件**

修改_config.fluid.yml文件（若未[覆盖主题配置](https://hexo.fluid-dev.com/docs/guide/#覆盖配置)，则需修改hexo默认配置）：

1. 设置 `banner.random_img: true`
2. 由于脚本仅在banner_img为空时生效，如需固定页面图片，填入具体图片路径即可

## 脚本位置

由于是“暴力式修改”，只用在博客根目录创建 `scripts/fluid_random_banner.js`，Hexo 启动时会自动加载此目录下的 js 文件，便于文件迁移。

## 完整代码

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_render:html', function(str, data) {
  const theme = hexo.theme.config;
  const page = data.page;

  // 检查是否开启
  if (!theme.banner || theme.banner.random_img !== true) return str;

  // 识别当前页面路径配置（优先级：页面 Front-matter > 主题布局配置 > 首页配置）
  let currentBanner = page.banner_img || 
                     (page.layout && theme[page.layout] && theme[page.layout].banner_img) ||
                     (page.path === 'index.html' && theme.index && theme.index.banner_img);

  // 若路径不为空，则跳过随机逻辑
  if (currentBanner && currentBanner.trim() !== '') return str;

  // 获取本地图片列表并处理路径
  const randomDir = path.join(hexo.source_dir, 'img', 'random');
  if (!fs.existsSync(randomDir)) return str;
  const files = fs.readdirSync(randomDir).filter(f => /\.(png|jpe?g|gif|svg|webp)$/i.test(f));
  if (files.length === 0) return str;

  const url_for = require('hexo-util').url_for.bind(hexo);
  const bannerList = JSON.stringify(files.map(f => url_for(`/img/random/${f}`)));

  // 构造并注入前端脚本
  const injectJs = `
    <script>
    (function() {
      var banners = ${bannerList};
      var randomImg = banners[Math.floor(Math.random() * banners.length)];
      var selectors = ['#banner', '#board + .full-bg-img', '.header-inner .full-bg-img', '.full-bg-img', '.banner'];
      
      var inject = function() {
        selectors.forEach(function(s) {
          var el = document.querySelector(s);
          if (el) el.style.setProperty('background-image', 'url("' + randomImg + '")', 'important');
        });
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
      } else { inject(); }
      setTimeout(inject, 100); 
      setTimeout(inject, 1000); 
    })();
    </script>
  `;

  return str.replace('</body>', injectJs + '</body>');
});
```

执行 `hexo clean && hexo s`，刷新浏览器即可看到随机效果。

## 小建议

若存放的图片过大，又不想自己压缩，可以配合 [hexo-all-minifier](https://github.com/chenzhutian/hexo-all-minifier)图片压缩插件使用，且脚本引用的路径依然指向压缩后的静态资源，不影响加载速度。
