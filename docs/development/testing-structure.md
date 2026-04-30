# Testing Structure

## Organización

**IMPORTANTE**: Todos los tests deben estar en la carpeta `/test`, **NUNCA** junto al código fuente.

```
test/
├── unit/
│   └── modules/
│       ├── health/
│       │   ├── health.controller.spec.ts
│       │   └── health.service.spec.ts
│       ├── auth/
│       │   ├── auth.controller.spec.ts
│       │   └── auth.service.spec.ts
│       ├── users/
│       │   ├── users.controller.spec.ts
│       │   └── users.service.spec.ts
│       └── [otro-modulo]/
├── e2e/
│   └── modules/
│       ├── health/
│       │   └── health.e2e-spec.ts
│       └── [otro-modulo]/
├── fixtures/
│   └── index.ts          # Factories y datos de prueba reutilizables
└── helpers/
    └── index.ts          # Utilidades para tests
```

## Reglas de Organización

### 1. Estructura por Módulos

Cada módulo debe tener su propia carpeta dentro de `test/unit/modules/[nombre-modulo]/` y `test/e2e/modules/[nombre-modulo]/`.

**Ejemplo**: Para el módulo `health`:
- Tests unitarios: `test/unit/modules/health/`
- Tests e2e: `test/e2e/modules/health/`

### 2. Naming Convention

- **Unit tests**: `[nombre].controller.spec.ts`, `[nombre].service.spec.ts`
- **E2E tests**: `[nombre].e2e-spec.ts`
- Usar **kebab-case** para nombres de archivos

### 3. Separación de Responsabilidades

- **Unit tests** (`test/unit/`): Testean componentes aislados (controllers, services, utils)
- **E2E tests** (`test/e2e/`): Testean flujos completos de la aplicación
- **Fixtures** (`test/fixtures/`): Datos de prueba reutilizables y factories
- **Helpers** (`test/helpers/`): Utilidades para tests (mocks, helpers de autenticación, etc.)

## Unit Tests

### Controllers

**Ubicación**: `test/unit/modules/[modulo]/[modulo].controller.spec.ts`

**Responsabilidades**:
- Mockear servicios
- Testear validación de entrada
- Testear respuestas HTTP
- Testear manejo de errores

**Ejemplo**:
```typescript
describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  const mockHealthService = {
    check: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: mockHealthService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health status', async () => {
    const expectedResult = { status: 'ok' };
    mockHealthService.check.mockResolvedValue(expectedResult);

    const result = await controller.check();

    expect(result).toEqual(expectedResult);
  });
});
```

### Services

**Ubicación**: `test/unit/modules/[modulo]/[modulo].service.spec.ts`

**Responsabilidades**:
- Mockear dependencias (repositories, otros servicios)
- Testear lógica de negocio
- Testear casos de error
- Testear validaciones

**Ejemplo**:
```typescript
describe('HealthService', () => {
  let service: HealthService;
  let supabaseService: SupabaseService;

  const mockSupabaseService = {
    getClient: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should return health status', async () => {
    const result = await service.check();

    expect(result).toHaveProperty('status', 'ok');
  });
});
```

### Utils

**Ubicación**: `test/unit/utils/[util].spec.ts`

**Responsabilidades**:
- Tests puros sin dependencias
- Testear funciones utilitarias

## E2E Tests

**Ubicación**: `test/e2e/modules/[modulo]/[modulo].e2e-spec.ts`

**Responsabilidades**:
- Testear flujos completos
- Testear integración con base de datos
- Testear endpoints completos

**Ejemplo**:
```typescript
describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
      });
  });
});
```

## Fixtures

**Ubicación**: `test/fixtures/index.ts`

**Uso**: Crear factories y datos de prueba reutilizables

**Ejemplo**:
```typescript
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});
```

## Helpers

**Ubicación**: `test/helpers/index.ts`

**Uso**: Utilidades para tests (mocks, helpers de autenticación, etc.)

**Ejemplo**:
```typescript
export const createTestModule = async (providers: any[]) => {
  return Test.createTestingModule({ providers }).compile();
};
```

## Convenciones

1. **Un archivo `.spec.ts` por archivo fuente**
2. **Usar `describe` e `it` para organización**
3. **Mockear todas las dependencias externas**
4. **Tests independientes y determinísticos**
5. **Usar `beforeEach` y `afterEach` para setup/cleanup**
6. **Nombres descriptivos**: `it('should return error when user not found')`

## Comandos

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con coverage
npm run test:cov

# Ejecutar solo tests e2e
npm run test:e2e
```

## Estructura de Test

```typescript
describe('ModuleService', () => {
  let service: ModuleService;
  let mockDependency: MockDependency;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ModuleService,
        { provide: Dependency, useValue: mockDependency },
      ],
    }).compile();

    service = module.get<ModuleService>(ModuleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      const input = 'test';
      mockDependency.method.mockResolvedValue('result');

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toBe('result');
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });
  });
});
```

## Recordatorios Importantes

- ✅ **SIEMPRE** poner tests en `/test`, nunca en `/src`
- ✅ Organizar por módulos dentro de `test/unit/modules/` y `test/e2e/modules/`
- ✅ Un archivo de test por archivo fuente
- ✅ Mockear todas las dependencias externas
- ✅ Tests deben ser independientes y determinísticos
