"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLGatewayModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const load_package_util_1 = require("@nestjs/common/utils/load-package.util");
const core_1 = require("@nestjs/core");
const _1 = require(".");
const graphql_constants_1 = require("../graphql.constants");
const utils_1 = require("../utils");
const federation_constants_1 = require("./federation.constants");
let GraphQLGatewayModule = (() => {
    var GraphQLGatewayModule_1;
    let GraphQLGatewayModule = GraphQLGatewayModule_1 = class GraphQLGatewayModule {
        constructor(httpAdapterHost, buildService, options, applicationConfig) {
            this.httpAdapterHost = httpAdapterHost;
            this.buildService = buildService;
            this.options = options;
            this.applicationConfig = applicationConfig;
        }
        get apolloServer() {
            return this._apolloServer;
        }
        static forRoot(options) {
            return {
                module: GraphQLGatewayModule_1,
                providers: [
                    {
                        provide: federation_constants_1.GRAPHQL_GATEWAY_MODULE_OPTIONS,
                        useValue: options,
                    },
                ],
            };
        }
        static forRootAsync(options) {
            return {
                module: GraphQLGatewayModule_1,
                imports: options.imports,
                providers: [
                    ...this.createAsyncProviders(options),
                    {
                        provide: graphql_constants_1.GRAPHQL_MODULE_ID,
                        useValue: utils_1.generateString(),
                    },
                ],
            };
        }
        static createAsyncProviders(options) {
            if (options.useExisting || options.useFactory) {
                return [this.createAsyncOptionsProvider(options)];
            }
            return [
                this.createAsyncOptionsProvider(options),
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
            ];
        }
        static createAsyncOptionsProvider(options) {
            if (options.useFactory) {
                return {
                    provide: federation_constants_1.GRAPHQL_GATEWAY_MODULE_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                };
            }
            return {
                provide: federation_constants_1.GRAPHQL_GATEWAY_MODULE_OPTIONS,
                useFactory: (optionsFactory) => optionsFactory.createGatewayOptions(),
                inject: [options.useExisting || options.useClass],
            };
        }
        onModuleInit() {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                const { httpAdapter } = this.httpAdapterHost || {};
                if (!httpAdapter) {
                    return;
                }
                const { ApolloGateway } = load_package_util_1.loadPackage('@apollo/gateway', 'ApolloGateway', () => require('@apollo/gateway'));
                const { options: { server: serverOpts = {}, gateway: gatewayOpts = {} }, buildService, } = this;
                const gateway = new ApolloGateway(Object.assign(Object.assign({}, gatewayOpts), { buildService }));
                yield this.registerGqlServer(Object.assign(Object.assign({}, serverOpts), { gateway, subscriptions: false }));
                if (serverOpts.installSubscriptionHandlers) {
                    throw new Error('No support for subscriptions yet when using Apollo Federation');
                }
            });
        }
        onModuleDestroy() {
            var _a;
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                yield ((_a = this._apolloServer) === null || _a === void 0 ? void 0 : _a.stop());
            });
        }
        registerGqlServer(apolloOptions) {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                const httpAdapter = this.httpAdapterHost.httpAdapter;
                const adapterName = httpAdapter.constructor && httpAdapter.constructor.name;
                if (adapterName === 'ExpressAdapter') {
                    this.registerExpress(apolloOptions);
                }
                else if (adapterName === 'FastifyAdapter') {
                    yield this.registerFastify(apolloOptions);
                }
                else {
                    throw new Error(`No support for current HttpAdapter: ${adapterName}`);
                }
            });
        }
        registerExpress(apolloOptions) {
            const { ApolloServer } = load_package_util_1.loadPackage('apollo-server-express', 'GraphQLModule', () => require('apollo-server-express'));
            const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig, } = apolloOptions;
            const app = this.httpAdapterHost.httpAdapter.getInstance();
            const path = this.getNormalizedPath(apolloOptions);
            const apolloServer = new ApolloServer(apolloOptions);
            apolloServer.applyMiddleware({
                app,
                path,
                disableHealthCheck,
                onHealthCheck,
                cors,
                bodyParserConfig,
            });
            this._apolloServer = apolloServer;
        }
        registerFastify(apolloOptions) {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                const { ApolloServer } = load_package_util_1.loadPackage('apollo-server-fastify', 'GraphQLModule', () => require('apollo-server-fastify'));
                const httpAdapter = this.httpAdapterHost.httpAdapter;
                const app = httpAdapter.getInstance();
                const path = this.getNormalizedPath(apolloOptions);
                const apolloServer = new ApolloServer(apolloOptions);
                const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig, } = apolloOptions;
                yield app.register(apolloServer.createHandler({
                    disableHealthCheck,
                    onHealthCheck,
                    cors,
                    bodyParserConfig,
                    path,
                }));
                this._apolloServer = apolloServer;
            });
        }
        getNormalizedPath(apolloOptions) {
            var _a;
            const prefix = this.applicationConfig.getGlobalPrefix();
            const useGlobalPrefix = prefix && ((_a = this.options.server) === null || _a === void 0 ? void 0 : _a.useGlobalPrefix);
            const gqlOptionsPath = utils_1.normalizeRoutePath(apolloOptions.path);
            return useGlobalPrefix
                ? utils_1.normalizeRoutePath(prefix) + gqlOptionsPath
                : gqlOptionsPath;
        }
    };
    GraphQLGatewayModule = GraphQLGatewayModule_1 = tslib_1.__decorate([
        common_1.Module({}),
        tslib_1.__param(0, common_1.Optional()),
        tslib_1.__param(1, common_1.Optional()),
        tslib_1.__param(1, common_1.Inject(_1.GATEWAY_BUILD_SERVICE)),
        tslib_1.__param(2, common_1.Inject(federation_constants_1.GRAPHQL_GATEWAY_MODULE_OPTIONS)),
        tslib_1.__metadata("design:paramtypes", [core_1.HttpAdapterHost, Function, Object, core_1.ApplicationConfig])
    ], GraphQLGatewayModule);
    return GraphQLGatewayModule;
})();
exports.GraphQLGatewayModule = GraphQLGatewayModule;
