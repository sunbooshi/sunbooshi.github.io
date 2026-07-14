'use strict';

/**
 * Fix absolute image paths for sub-directory deployment.
 * Prepends config.root to src="/images/..." paths in generated HTML.
 * Only affects paths that start with /images/, avoiding double-prefixing
 * paths that already include the root (e.g. /blog/images/...).
 */
hexo.extend.filter.register('after_render:html', function (data) {
  const root = hexo.config.root || '/';
  if (root === '/') return data;

  return data.replace(
    /(src=["'])\/images\//gi,
    '$1' + root + 'images/'
  );
});
