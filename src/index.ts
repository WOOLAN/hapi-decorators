import * as Joi from 'joi';
import * as Hapi from 'hapi';
import 'reflect-metadata';

export interface IDecoratorConfig {
    method: string;
    path: string;
    description?: string;
    notes?: string;
    tags?: string[];
    params?: {
        [param: string]: Joi.Schema;
    } | Joi.Schema;
    query?: {
        [key: string]: Joi.Schema;
    } | Joi.Schema;
    payload?: IPayload | Joi.Schema;
    responses?: {
        [code: number]: {
            description?: string;
            schema?: Joi.Schema | { type: string };
        };
    };
    produces?: string[];
    consumes?: string[];
    security?: ISecurity[];
    auth?: string | boolean;
}

export interface IPayload {
    type?: string;
    output?: string;
    parse?: boolean;
    validate?: Joi.Schema;
}

export interface ISecurity {
    [name: string]: string[];
}

function isPayload(payload: any): payload is IPayload {
    if (!payload) {
        return false;
    }

    return !payload.isJoi;
}

export function Controller(path: string = '') {
    return function(constructor: any) {
        let routes: any[] = Reflect.getMetadata('hapi:routes', constructor);
        let apiPath = '/api' + path;

        constructor.prototype.routes = function() {
            if (routes) {
                for (let i: number = 0; i < routes.length; ++i) {
                    if (routes[i].config.tags) {
                        routes[i].path = apiPath + routes[i].path;
                    } else {
                        routes[i].path = path + routes[i].path;
                    }

                    routes[i].config.bind = this;
                }
            } else {
                routes = [];
            }
            return routes;
        };
    };
};

export function Route(config: IDecoratorConfig) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        let routes: any[] = Reflect.getMetadata('hapi:routes', target.constructor);
        let fn: Function = descriptor.value;

        if (!routes) {
            routes = [];
        }

        let handler: Hapi.IRouteConfiguration = {
            method: config.method,
            path: config.path,
            handler: fn,
            config: {}
        };

        if (config.tags && Array.isArray(config.tags) && config.tags.length > 0) {
            handler.config = {
                description: config.description || null,
                notes: config.notes || null,
                tags: config.tags,
                auth: config.auth === undefined ? null : config.auth,
                plugins: {
                    'hapi-swagger': {
                        responses: config.responses || null,
                        produces: config.produces || null,
                        consumes: config.consumes || null,
                        security: config.security || null
                    }
                },
                validate: {
                    query: config.query || null,
                    params: config.params || null
                }
            };

            let payload = config.payload;

            if (isPayload(payload)) {
                handler.config.plugins['hapi-swagger'].payloadType = payload.type || null;

                if (payload.output || payload.parse !== undefined) {
                    handler.config.payload = {
                        output: payload.output || null,
                        parse: payload.parse || null
                    };
                }

                handler.config.validate.payload = payload.validate || null;
            } else {
                handler.config.validate.payload = payload || null;
            }
        }

        routes.push(handler);
        Reflect.defineMetadata('hapi:routes', routes, target.constructor);
    };
};
