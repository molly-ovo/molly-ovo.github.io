'use strict';

const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_render:html', function(str, data) {
  if (!str || !str.includes('<head')) return str; // 改为检查 head，我们要提前注入

  const theme = hexo.theme.config;
  // 检查是否开启了随机功能
  if (!theme.banner || theme.banner.random_img !== true) return str;

  // 如果页面已经手动指定了 banner_img，则跳过随机逻辑
  if (data.page.banner_img && data.page.banner_img.trim() !== '') return str;

  const randomDir = path.join(hexo.source_dir, 'img', 'random');
  if (!fs.existsSync(randomDir)) return str;

  const files = fs.readdirSync(randomDir).filter(f => /\.(png|jpe?g|gif|svg|webp)$/i.test(f));
  if (files.length === 0) return str;

  const url_for = require('hexo-util').url_for.bind(hexo);
  const bannerList = JSON.stringify(files.map(f => url_for(`/img/random/${f}`)));

  // --- 优化核心：使用即时执行的脚本直接注入 CSS 样式 ---
  // 这样在浏览器渲染 #banner 标签的那一刻，背景图就已经被覆盖了，不会有闪烁
  const injectCode = `
    <script>
    (function() {
      var banners = ${bannerList};
      var randomImg = banners[Math.floor(Math.random() * banners.length)];
      var style = document.createElement('style');
      // 直接通过 CSS 选择器覆盖，!important 确保优先级最高
      style.innerHTML = '#banner, .full-bg-img, .header-inner .full-bg-img { background-image: url("' + randomImg + '") !important; }';
      document.head.appendChild(style);
      
      // 预加载这张图，让显示更丝滑
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = randomImg;
      document.head.appendChild(link);
    })();
    </script>
  `;

  // 将脚本注入到 <head> 标签的最前面，确保在 DOM 渲染前生效
  return str.replace(/<head>/i, '<head>' + injectCode);
});