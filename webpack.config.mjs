import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import wp from 'webpack'
import { AngularWebpackPlugin } from '@ngtools/webpack'
import { createEs2015LinkerPlugin } from '@angular/compiler-cli/linker/babel'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const linkerPlugin = createEs2015LinkerPlugin({
    linkerJitMode: true,
    fileSystem: {
        resolve: path.resolve,
        exists: fs.existsSync,
        dirname: path.dirname,
        relative: path.relative,
        readFile: fs.readFileSync,
    },
})

const isDev = !!process.env.TABBY_DEV

const sourceMapOptions = {
    exclude: [/node_modules/, /vendor/],
    filename: '[file].map',
    moduleFilenameTemplate: 'webpack-tabby-ai-assistant:///[resource-path]',
}

let devtoolPlugin = wp.SourceMapDevToolPlugin

if ((process.platform === 'win32' || process.platform === 'linux') && isDev) {
    devtoolPlugin = wp.EvalSourceMapDevToolPlugin
}

export default {
    target: 'node',
    entry: './src/index.ts',
    context: __dirname,
    devtool: false,
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        pathinfo: true,
        libraryTarget: 'umd',
        publicPath: 'auto',
    },
    mode: isDev ? 'development' : 'production',
    optimization: {
        minimize: false,
    },
    cache: !isDev ? false : {
        type: 'filesystem',
        cacheDirectory: path.resolve(__dirname, 'node_modules', '.webpack-cache'),
    },
    resolve: {
        modules: ['.', 'src', 'node_modules'].map(x => path.join(__dirname, x)),
        extensions: ['.ts', '.js'],
        mainFields: ['esm2015', 'browser', 'module', 'main'],
    },
    ignoreWarnings: [/Failed to parse source map/],
    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: 'pre',
                use: {
                    loader: 'source-map-loader',
                    options: {
                        filterSourceMappingUrl: (url, resourcePath) => {
                            if (/node_modules/.test(resourcePath)) {
                                return false
                            }
                            return true
                        },
                    },
                },
            },
            {
                test: /\.(m?)js$/,
                loader: 'babel-loader',
                options: {
                    plugins: [linkerPlugin],
                    compact: false,
                    cacheDirectory: true,
                },
                resolve: {
                    fullySpecified: false,
                },
            },
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: '@ngtools/webpack',
                    },
                ],
            },
            {
                test: /\.pug$/,
                use: [
                    'apply-loader',
                    {
                        loader: 'pug-loader',
                        options: {
                            pretty: true,
                        },
                    },
                ],
            },
            {
                test: /\.scss$/,
                use: ['@tabby-gang/to-string-loader', 'css-loader', 'sass-loader'],
                include: /(theme.*|component)\.scss/,
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'css-loader', 'sass-loader'],
                exclude: /(theme.*|component)\.scss/,
            },
            {
                test: /\.css$/,
                use: ['@tabby-gang/to-string-loader', 'css-loader'],
                include: /component\.css/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
                exclude: /component\.css/,
            },
        ],
    },
    externals: [
        '@electron/remote',
        'any-promise',
        'child_process',
        'electron-promise-ipc',
        'electron-updater',
        'electron',
        'fs',
        'net',
        'ngx-toastr',
        'os',
        'path',
        'readline',
        'stream',
        /^@angular(?!\/common\/locales)/,
        /^@ng-bootstrap/,
        /^rxjs/,
        /^tabby-/,
    ],
    plugins: [
        new devtoolPlugin(sourceMapOptions),
        new AngularWebpackPlugin({
            tsconfig: path.resolve(__dirname, 'tsconfig.json'),
            directTemplateLoading: false,
            jitMode: true,
        }),
    ],
}
