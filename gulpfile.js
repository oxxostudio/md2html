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
  sitemap = require('gulp-sitemap');

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
 * 記得加入 marked 的設定
 */
gulp.task('markdown', ['tutorialLayout'], function() {
  return gulp.src('app/_md/**/*.md')
    .pipe(markdown({
      renderer: renderer
    }))
    .pipe(gulp.dest('app/_md2html/'));
});


/**
 * 合併 layout
 */
gulp.task('extender', ['markdown'], function() {
  return gulp.src('app/_md2html/**/*')
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
  return gulp.src('app/_less/*.less')
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
    .pipe(md2json(marked, 'tutorials.json', function(data, file){
      delete data.body;
      data.date = file.date;
      return data;
    }))
    .pipe(gulp.dest('app/json'))
});


/** 
 * build 
 */
gulp.task('build-clean', function() {
  return gulp.src(['build/*'], {
      read: true
    })
    .pipe(clean());
});


/**
 * 根據網頁內容，產生對應的 meta 標籤
 */
gulp.task('build-meta', ['build-clean'], function() {
  return gulp.src('app/tutorials/**/*')
    .pipe(dom(function() {

      var article = this.querySelector('article');
      var hr = this.querySelectorAll('hr');

      var baseUrl = 'https://webduino.io/';

      var note = this.querySelectorAll('p')[0];
      var nodelist = note.innerHTML.split('\n');
      var nodeObject = {};
      nodelist.forEach(function(e, i) {
        nodeObject[e.split(': ')[0]] = e.split(': ')[1];
      });

      var img = nodeObject.img;
      var title = nodeObject.title;
      var folder = nodeObject.folder;
      var src = nodeObject.src;

      var description = this.querySelectorAll('p')[1].innerHTML;
      var meta = this.querySelectorAll('meta');
      var metaToArray = Array.apply(null, meta);

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

      this.querySelectorAll('title')[0].innerHTML = title;

      article.removeChild(note);
      article.removeChild(hr[0]);
      article.removeChild(hr[1]);

      return this;
    }))
    .pipe(gulp.dest('build/tutorials'));
});


/** 
 * 透過 gulp-stream 來合併 task 
 */
gulp.task('build-move', ['build-meta'], function() {
  var a1 = gulp.src('app/json/*').pipe(gulp.dest('build/json')),
    a2 = gulp.src('app/style/**/*').pipe(gulp.dest('build/style'));
  return merge(a1, a2);
});


/**
 * 根據網頁結構，自動產生 sitemap.xml
 */
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
  gulp.watch(['app/_less/*.less', 'app/_less/lib/*'], ['copy-to-css']);
});


/** 
 * 應該不用每次編輯都做一次清除動作，在開始前先清除一次即可
 */
gulp.task('clean', function() {
  return gulp.src(['app/_md2html/*', 'app/tutorials/*','app/style/*'], {
      read: true
    })
    .pipe(clean());
});

gulp.task('default', ['md2json', 'less2css', 'watch']);
