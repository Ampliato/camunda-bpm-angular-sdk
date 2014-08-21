var gulp = require('gulp');
var concat = require('gulp-concat');
var ngAnnotate = require('gulp-ng-annotate');
var uglify = require('gulp-uglify');
var rename = require("gulp-rename");
var ngTemplateCache = require('gulp-angular-templatecache');

gulp.task('templatecache', function () {
	return gulp.src('./lib/**/*.html')
		.pipe(ngTemplateCache({module: "camBpmSdk"}))
		.pipe(gulp.dest('./templates'));
});

gulp.task('concat', ['templatecache'], function () {
	return gulp.src(['./lib/**/*.js', './templates/**/*.js'])
		.pipe(ngAnnotate())
		// Swallow error, so that watch keeps working
		.on('error', function(err){
			console.error(err);
		})
		.pipe(concat('camunda-bpm-angular-sdk.all.js'))
		.pipe(gulp.dest('./dist'));
});

gulp.task('uglify', ['concat'], function () {
	return gulp.src('./dist/camunda-bpm-angular-sdk.all.js')
		.pipe(uglify())
		.pipe(rename('camunda-bpm-angular-sdk.all.min.js'))
		.pipe(gulp.dest('./dist'));
});

gulp.task('build', ['uglify']);

gulp.task('watch', function () {
	gulp.watch('./lib/**/*', ['build']);
});
