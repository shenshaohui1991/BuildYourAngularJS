/**
 * Created by Tea on 2017/3/20.
 */
const gulp = require('gulp');
const eslint = require('gulp-eslint');
const mocha = require('gulp-mocha');

gulp.task('lint', () => {
    return gulp.src(['./src/**/*.js', './test/**/*.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('test', () => {
    return gulp.src('./test/**/*.js')
        //.pipe(mocha({reporter: 'landing'}));
        .pipe(mocha({reporter: 'spec'}));
});