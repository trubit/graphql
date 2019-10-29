import { DynamicModule, Inject, Module, OnModuleInit, Optional, Provider } from '@nestjs/common';
import { ApolloServerBase, Config as ApolloServerConfig } from 'apollo-server-core';
import { HttpAdapterHost } from '@nestjs/core';
import {
  GRAPHQL_GATEWAY_BUILD_SERVICE,
  GRAPHQL_GATEWAY_MODULE_OPTIONS,
  GRAPHQL_MODULE_ID,
} from './graphql.constants';
import {
  GatewayBuildService,
  GatewayModuleOptions,
  GatewayOptionsFactory,
  GatewayModuleAsyncOptions,
} from './interfaces';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { generateString } from './utils';

@Module({})
export class GraphQLGatewayModule implements OnModuleInit {
  private apolloServer: ApolloServerBase;

  constructor(
    @Optional()
    private readonly httpAdapterHost: HttpAdapterHost,
    @Optional()
    @Inject(GRAPHQL_GATEWAY_BUILD_SERVICE)
    private readonly buildService: GatewayBuildService,
    @Inject(GRAPHQL_GATEWAY_MODULE_OPTIONS)
    private readonly options: GatewayModuleOptions,
  ) {}

  static forRoot(options: GatewayModuleOptions): DynamicModule {
    return {
      module: GraphQLGatewayModule,
      providers: [
        {
          provide: GRAPHQL_GATEWAY_MODULE_OPTIONS,
          useValue: options,
        },
      ],
    };
  }

  static forRootAsync(options: GatewayModuleAsyncOptions): DynamicModule {
    return {
      module: GraphQLGatewayModule,
      imports: options.imports,
      providers: [
        ...this.createAsyncProviders(options),
        {
          provide: GRAPHQL_MODULE_ID,
          useValue: generateString(),
        },
      ],
    };
  }

  private static createAsyncProviders(options: GatewayModuleAsyncOptions): Provider[] {
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

  private static createAsyncOptionsProvider(options: GatewayModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: GRAPHQL_GATEWAY_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: GRAPHQL_GATEWAY_MODULE_OPTIONS,
      useFactory: (optionsFactory: GatewayOptionsFactory) => optionsFactory.createGatewayOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }

  async onModuleInit() {
    const { httpAdapter } = this.httpAdapterHost || {};

    if (!httpAdapter) {
      return;
    }

    const { ApolloGateway } = loadPackage('@apollo/gateway', 'ApolloGateway');
    const {
      options: { __exposeQueryPlanExperimental, debug, serviceList, installSubscriptionHandlers },
      buildService,
    } = this;

    const gateway = new ApolloGateway({
      __exposeQueryPlanExperimental,
      debug,
      serviceList,
      buildService,
    });

    const { schema, executor } = await gateway.load();
    this.registerGqlServer({ schema, executor });

    if (installSubscriptionHandlers) {
      // TL;DR <https://github.com/apollographql/apollo-server/issues/2776>
      throw new Error('No support for subscriptions yet when using Apollo Federation');
      /*this.apolloServer.installSubscriptionHandlers(
        httpAdapter.getHttpServer(),
      );*/
    }
  }

  private registerGqlServer(apolloOptions: ApolloServerConfig) {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const adapterName = httpAdapter.constructor && httpAdapter.constructor.name;

    if (adapterName === 'ExpressAdapter') {
      this.registerExpress(apolloOptions);
    } else if (adapterName === 'FastifyAdapter') {
      this.registerFastify(apolloOptions);
    } else {
      throw new Error(`No support for current HttpAdapter: ${adapterName}`);
    }
  }

  private registerExpress(apolloOptions: ApolloServerConfig) {
    const { ApolloServer } = loadPackage('apollo-server-express', 'GraphQLModule', () =>
      require('apollo-server-express'),
    );
    const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig, path } = this.options;
    const app = this.httpAdapterHost.httpAdapter.getInstance();

    const apolloServer = new ApolloServer(apolloOptions);
    apolloServer.applyMiddleware({
      app,
      path,
      disableHealthCheck,
      onHealthCheck,
      cors,
      bodyParserConfig,
    });
    this.apolloServer = apolloServer;
  }

  private registerFastify(apolloOptions: ApolloServerConfig) {
    const { ApolloServer } = loadPackage('apollo-server-fastify', 'GraphQLModule', () =>
      require('apollo-server-fastify'),
    );

    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    const apolloServer = new ApolloServer(apolloOptions as any);
    const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig, path } = this.options;
    app.register(
      apolloServer.createHandler({
        disableHealthCheck,
        onHealthCheck,
        cors,
        bodyParserConfig,
        path,
      }),
    );

    this.apolloServer = apolloServer;
  }
}
