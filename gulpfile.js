var gulp = require('gulp'),
  markdown = require('gulp-markdown'),
  dom = require('gulp-dom'),
  rename = require("gulp-rename"),
  clean = require("gulp-clean"),
  less = require('gulp-less'),
  md2json = require('gulp-markdown-to-json'),
  md = require('marked'),
  gutil = require('gulp-util'),
  extender = require('gulp-html-extend'),
  merge = require('merge-stream'),
  sitemap = require('gulp-sitemap'),
  changed = require('gulp-changed'),
  runSequence = require('run-sequence');

/**
 * markdown to html
 * marked 設定，避免產生的 h tag 會出現轉不出中文的奇怪 id
 * 參考 https://www.npmjs.com/package/marked
 * 參考 https://www.npmjs.com/package/gulp-markdown
 */
var marked = markdown.marked;
var renderer = new marked.Renderer();
renderer.heading = function(text, level) {
  return '<h' + level + '>' + text + '</h' + level + '>\n';
};

gulp.task('tutorialLayout', function() {
  return gulp.src('app/_meta-md.html')
    .pipe(extender({
      annotations: false,
      verbose: false
    }))
    .pipe(rename(function(path) {
      path.basename = "_layout-tutorials";
    }))
    .pipe(gulp.dest('app'));
});


/**
 * markdown 轉換成 html，記得加入 marked 的設定
 * changed 幫助我們只轉換有改變的檔案，增加效能
 * 記得要加入 extension: '.html' 的設定，不然會失效
 * 參考 https://www.npmjs.com/package/gulp-changed
 */
gulp.task('markdown', ['tutorialLayout'], function() {
  return gulp.src('app/_md/**/*.md')
    .pipe(changed('app/_md2html/', {
      extension: '.html'
    }))
    .pipe(markdown({
      renderer: renderer
    }))
    .pipe(gulp.dest('app/_md2html/'));
});

/**
 * 轉換後的 html 合併 layout
 */
gulp.task('extender', ['markdown'], function() {
  return gulp.src('app/_md2html/**/*')
    .pipe(changed('app/tutorials/', {
      extension: '.html'
    }))
    .pipe(extender({
      annotations: false,
      verbose: false
    }))
    .pipe(gulp.dest('app/tutorials/'));
});


/**
 * less to css
 */
gulp.task('less', function() {
  return gulp.src(['app/_less/*.less','!app/_less/import/*.less'])
    .pipe(less())
    .pipe(gulp.dest('app/style/'))
});

gulp.task('less2css', ['less'], function() {
  return gulp.src('app/_less/lib/**/*').pipe(gulp.dest('app/style/lib'));
});


/**
 * 透過 delete data.body 避免產生的 json 包含 body
 * 參考 https://www.npmjs.com/package/gulp-markdown-to-json
 */
gulp.task('md2json', ['extender'], function() {
  return gulp.src(['app/_md/**/*.md'])
    .pipe(gutil.buffer())
    .pipe(md2json(marked, 'tutorials.json', function(data, file) {
      delete data.body;
      return data;
    }))
    .pipe(gulp.dest('app/json'))
});

/**
 * 根據網頁內容，產生對應的 meta 標籤內容
 * 預存在陣列內，待會產生真正 meta 內容的時候會用到
 */
var metaData = [];
var baseUrl = 'https://webduino.io/';

/** 
 * build 前先清空原本舊的 build 內容
 * 並確認 metaData 為空陣列
 */
gulp.task('build-clean', function() {
  metaData = [];
  return gulp.src(['build/*'], {
      read: true
    })
    .pipe(clean());
});

gulp.task('build-meta-json', ['build-clean'], function() {
  return gulp.src('app/_md2html/**/*')
    .pipe(dom(function() {

      var note = this.querySelector('p');
      var nodelist = note.innerHTML.split('\n');
      var nodeObject = {};
      nodelist.forEach(function(e, i) {
        nodeObject[e.split(': ')[0]] = e.split(': ')[1];
      });
      metaData.push(nodeObject);
      return this;
    }));
});

/**
 * 產生每一頁的 meta 內容
 */
gulp.task('build-meta', ['build-meta-json'], function() {
  return gulp.src('app/tutorials/**/*')
    .pipe(dom(function() {

      var img, folder, src;

      var title = this.querySelector('h1').innerHTML;
      var description = this.querySelector('p').innerHTML;
      var meta = this.querySelectorAll('meta');
      var metaToArray = Array.apply(null, meta);

      metaData.forEach(function(e) {
        if (title == e.title) {
          img = e.img;
          folder = e.folder;
          src = e.src;
        }
      });

      this.querySelector('title').innerHTML = title;

      metaToArray.forEach(function(e) {
        if (e.getAttribute('property') == 'og:title') {
          e.setAttribute('content', title);
        }
        if (e.getAttribute('property') == 'og:description' || e.getAttribute('itemprop') == 'description' || e.getAttribute('name') == 'description') {
          e.setAttribute('content', description);
        }
        if (e.getAttribute('property') == 'og:image' || e.getAttribute('itemprop') == 'image') {
          e.setAttribute('content', baseUrl + 'img/' + folder + '/' + img);
        }
        if (e.getAttribute('property') == 'og:url') {
          e.setAttribute('content', baseUrl + 'tutorials/' + folder + '/' + src);
        }
      });

      return this;
    }))
    .pipe(gulp.dest('build/tutorials'));
});

/** 
 * 透過 gulp-stream 來合併 task 
 * build 的時候根據網頁結構，自動產生 sitemap.xml
 */
gulp.task('build-move', ['build-meta'], function() {
  var a1 = gulp.src('app/json/*').pipe(gulp.dest('build/json')),
    a2 = gulp.src('app/style/**/*').pipe(gulp.dest('build/style'));
  return merge(a1, a2);
});

gulp.task('build', ['build-move'], function() {
  return gulp.src(['build/**/*.html'])
    .pipe(sitemap({
      siteUrl: 'https://webduino.io'
    }))
    .pipe(gulp.dest('build'));
});


/** 
 * watch 
 */
gulp.task('watch', function() {
  gulp.watch(['_layout.html', '_layout-tutorials.html', '_meta-md.html'], ['extender']);
  gulp.watch(['app/_md/**/*.md'], ['md2json']);
  gulp.watch(['app/_less/**/*'], ['copy-to-css']);
});


/** 
 * 不用每次編輯都做一次清除動作，在開始前先清除一次即可
 * 透過 runSequence 讓開始前先執行一次清除動作
 * 參考 https://www.npmjs.com/package/run-sequence
 */
gulp.task('clean', function() {
  return gulp.src(['app/_md2html/*', 'app/tutorials/*', 'app/style/*'], {
      read: true
    })
    .pipe(clean());
});

gulp.task('default', function(callback) {
  runSequence('clean', ['md2json', 'less2css', 'watch'],
    callback);
});
