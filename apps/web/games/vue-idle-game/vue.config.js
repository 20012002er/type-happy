module.exports = {
  // 以相对路径打包，便于放到主站的 /games/idle/ 子路径下运行
  publicPath: './',
  productionSourceMap: false,
  css: {
    loaderOptions: {
      sass: {
        implementation: require('sass'),
      },
    },
  },
}
