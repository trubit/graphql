"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterfaceDefinitionFactory = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const graphql_1 = require("graphql");
const return_type_cannot_be_resolved_error_1 = require("../errors/return-type-cannot-be-resolved.error");
const orphaned_reference_registry_1 = require("../services/orphaned-reference.registry");
const type_fields_accessor_1 = require("../services/type-fields.accessor");
const type_definitions_storage_1 = require("../storages/type-definitions.storage");
const type_metadata_storage_1 = require("../storages/type-metadata.storage");
const get_interfaces_array_util_1 = require("../utils/get-interfaces-array.util");
const args_factory_1 = require("./args.factory");
const ast_definition_node_factory_1 = require("./ast-definition-node.factory");
const output_type_factory_1 = require("./output-type.factory");
const resolve_type_factory_1 = require("./resolve-type.factory");
let InterfaceDefinitionFactory = (() => {
    let InterfaceDefinitionFactory = class InterfaceDefinitionFactory {
        constructor(resolveTypeFactory, typeDefinitionsStorage, outputTypeFactory, orphanedReferenceRegistry, typeFieldsAccessor, argsFactory, astDefinitionNodeFactory) {
            this.resolveTypeFactory = resolveTypeFactory;
            this.typeDefinitionsStorage = typeDefinitionsStorage;
            this.outputTypeFactory = outputTypeFactory;
            this.orphanedReferenceRegistry = orphanedReferenceRegistry;
            this.typeFieldsAccessor = typeFieldsAccessor;
            this.argsFactory = argsFactory;
            this.astDefinitionNodeFactory = astDefinitionNodeFactory;
        }
        create(metadata, options) {
            const prototype = Object.getPrototypeOf(metadata.target);
            const getParentType = () => {
                const parentTypeDefinition = this.typeDefinitionsStorage.getObjectTypeByTarget(prototype) ||
                    this.typeDefinitionsStorage.getInterfaceByTarget(prototype);
                return parentTypeDefinition ? parentTypeDefinition.type : undefined;
            };
            const resolveType = this.createResolveTypeFn(metadata);
            return {
                target: metadata.target,
                isAbstract: metadata.isAbstract || false,
                interfaces: get_interfaces_array_util_1.getInterfacesArray(metadata.interfaces),
                type: new graphql_1.GraphQLInterfaceType({
                    name: metadata.name,
                    description: metadata.description,
                    fields: this.generateFields(metadata, options),
                    interfaces: this.generateInterfaces(metadata, getParentType),
                    resolveType,
                    astNode: this.astDefinitionNodeFactory.createInterfaceTypeNode(metadata.name, metadata.directives),
                }),
            };
        }
        createResolveTypeFn(metadata) {
            const objectTypesMetadata = type_metadata_storage_1.TypeMetadataStorage.getObjectTypesMetadata();
            const implementedTypes = objectTypesMetadata
                .filter((objectType) => {
                const interfaces = get_interfaces_array_util_1.getInterfacesArray(objectType.interfaces);
                return interfaces.includes(metadata.target);
            })
                .map((objectType) => objectType.target);
            return metadata.resolveType
                ? this.resolveTypeFactory.getResolveTypeFunction(metadata.resolveType)
                : (instance) => {
                    const target = implementedTypes.find((Type) => instance instanceof Type);
                    if (!target) {
                        throw new return_type_cannot_be_resolved_error_1.ReturnTypeCannotBeResolvedError(metadata.name);
                    }
                    return this.typeDefinitionsStorage.getObjectTypeByTarget(target).type;
                };
        }
        generateFields(metadata, options) {
            const prototype = Object.getPrototypeOf(metadata.target);
            metadata.properties.forEach(({ typeFn }) => this.orphanedReferenceRegistry.addToRegistryIfOrphaned(typeFn()));
            const getParentType = () => {
                const parentTypeDefinition = this.typeDefinitionsStorage.getInterfaceByTarget(prototype);
                return parentTypeDefinition ? parentTypeDefinition.type : undefined;
            };
            return () => {
                let fields = {};
                metadata.properties.forEach((field) => {
                    const type = this.outputTypeFactory.create(field.name, field.typeFn(), options, field.options);
                    fields[field.schemaName] = {
                        description: field.description,
                        type,
                        args: this.argsFactory.create(field.methodArgs, options),
                        resolve: (root) => {
                            const value = root[field.name];
                            return typeof value === 'undefined'
                                ? field.options.defaultValue
                                : value;
                        },
                        deprecationReason: field.deprecationReason,
                        astNode: this.astDefinitionNodeFactory.createFieldNode(field.name, type, field.directives),
                        extensions: Object.assign({ complexity: field.complexity }, field.extensions),
                    };
                });
                if (!shared_utils_1.isUndefined(prototype.prototype)) {
                    const parentClassRef = getParentType();
                    if (parentClassRef) {
                        const parentFields = this.typeFieldsAccessor.extractFromInterfaceOrObjectType(parentClassRef);
                        fields = Object.assign(Object.assign({}, parentFields), fields);
                    }
                }
                return fields;
            };
        }
        generateInterfaces(metadata, getParentType) {
            const prototype = Object.getPrototypeOf(metadata.target);
            return () => {
                var _a, _b;
                const interfaces = get_interfaces_array_util_1.getInterfacesArray(metadata.interfaces).map((item) => this.typeDefinitionsStorage.getInterfaceByTarget(item).type);
                if (!shared_utils_1.isUndefined(prototype)) {
                    const parentClass = getParentType();
                    if (!parentClass) {
                        return interfaces;
                    }
                    const parentInterfaces = (_b = (_a = parentClass.getInterfaces) === null || _a === void 0 ? void 0 : _a.call(parentClass)) !== null && _b !== void 0 ? _b : [];
                    return Array.from(new Set([...interfaces, ...parentInterfaces]));
                }
                return interfaces;
            };
        }
    };
    InterfaceDefinitionFactory = tslib_1.__decorate([
        common_1.Injectable(),
        tslib_1.__metadata("design:paramtypes", [resolve_type_factory_1.ResolveTypeFactory,
            type_definitions_storage_1.TypeDefinitionsStorage,
            output_type_factory_1.OutputTypeFactory,
            orphaned_reference_registry_1.OrphanedReferenceRegistry,
            type_fields_accessor_1.TypeFieldsAccessor,
            args_factory_1.ArgsFactory,
            ast_definition_node_factory_1.AstDefinitionNodeFactory])
    ], InterfaceDefinitionFactory);
    return InterfaceDefinitionFactory;
})();
exports.InterfaceDefinitionFactory = InterfaceDefinitionFactory;
