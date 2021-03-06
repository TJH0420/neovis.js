import Neo4j, * as Neo4jMock from 'neo4j-driver';
import Neovis from '../src/neovis';
import { NEOVIS_DEFAULT_CONFIG } from '../src/neovis';
import { CompletionEvent } from '../src/events';
import * as testUtils from './testUtils';

jest.mock('neo4j-driver');

describe('Neovis', () => {
	const container_id = 'randomId';
	const initial_cypher = 'test query';
	const label1 = 'label1';
	const relationshipType = 'TEST';
	let neovis;

	beforeEach(() => Neo4jMock.clearAllMocks());
	beforeEach(() => {
		testUtils.clearIdCounter();
		document.body.innerHTML = `<div id="${container_id}"></div>`;
	});

	describe('NeoVis config defaults behavior', () => {
		let config = {};
		beforeEach(() => {
			config = {};
		});
		it('should merge default symbol for each label config', () => {
			config.labels = {
				a: {
					caption: 'name'
				},
				[NEOVIS_DEFAULT_CONFIG]: {
					test: 'test'
				}
			};
			const neovis = new Neovis(config);
			expect(neovis._config.labels.a).toMatchObject({caption: 'name', test: 'test'});
		});
		it('should not change the config sent', () => {
			config = {
				labels: {
					a: {
						caption: 'name'
					},
					[NEOVIS_DEFAULT_CONFIG]: {
						test: 'test'
					}
				},
				relationships: {
					a: {
						thickness: 0.1
					},
					[NEOVIS_DEFAULT_CONFIG]: {
						test: 'test'
					}
				}
			};
			const configTemp = {...config};
			new Neovis(config);
			expect(config).toMatchObject(configTemp);
		});
		it('should override default config if specific label have one', () => {
			config.relationships = {
				a: {
					caption: 'name',
					overrideThis: 'overridden'
				},
				[NEOVIS_DEFAULT_CONFIG]: {
					test: 'test',
					overrideThis: 'override'
				}
			};
			const neovis = new Neovis(config);
			expect(neovis._config.relationships.a).toMatchObject({
				caption: 'name', test: 'test', overrideThis: 'overridden'
			});
		});
		it('should merge default symbol for each relationship config', () => {
			config.labels = {
				a: {
					caption: 'name'
				},
				[NEOVIS_DEFAULT_CONFIG]: {
					test: 'test'
				}
			};
			const neovis = new Neovis(config);
			expect(neovis._config.labels.a).toMatchObject({caption: 'name', test: 'test'});
		});
		it('should override default config if specific relationship have one', () => {
			config.relationships = {
				a: {
					caption: 'name',
					overrideThis: 'overridden'
				},
				[NEOVIS_DEFAULT_CONFIG]: {
					test: 'test',
					overrideThis: 'override'
				}
			};
			const neovis = new Neovis(config);
			expect(neovis._config.relationships.a).toMatchObject({
				caption: 'name', test: 'test', overrideThis: 'overridden'
			});
		});
	});

	describe('Neovis default behavior', () => {
		beforeEach(() => {
			neovis = new Neovis({initial_cypher, container_id});
		});

		it('should call run with query', () => {
			neovis.render();
			expect(Neo4jMock.mockSessionRun).toHaveBeenCalledWith(initial_cypher, {limit: 30});
		});

		it('should call completed when complete', () => new Promise(done => {
			testUtils.mockNormalRunSubscribe();
			neovis.render();
			neovis.registerOnEvent(CompletionEvent, () => {
				expect(true).toBe(true);
				done();
			});
		}));

		it('should save records to dataset', async () => {
			testUtils.mockNormalRunSubscribe([
				testUtils.makeRecord([testUtils.makeNode([label1])]),
			]);
			neovis.render();
			await testUtils.neovisRenderDonePromise(neovis);
			expect(neovis._data.nodes.get(1)).toBeDefined();
		});

		it('should save paths to dataset', async () => {
			testUtils.mockNormalRunSubscribe([
				testUtils.makeRecord([testUtils.makePathFromNodes([
					testUtils.makeNode([label1]),
					testUtils.makeNode([label1])
				], relationshipType)]),
			]);
			neovis.render();
			await testUtils.neovisRenderDonePromise(neovis);
			expect(neovis._data.nodes.length).toBe(2);
			expect(neovis._data.edges.length).toBe(1);
		});

		it('should save record with multiple parameters', async () => {
			const firstNode = testUtils.makeNode([label1]);
			const secondNode = testUtils.makeNode([label1]);
			const relationship = testUtils.makeRelationship(relationshipType, firstNode, secondNode);
			testUtils.mockNormalRunSubscribe([
				testUtils.makeRecord([firstNode, secondNode, relationship])
			]);
			neovis.render();
			await testUtils.neovisRenderDonePromise(neovis);
			expect(neovis._data.nodes.length).toBe(2);
			expect(neovis._data.edges.length).toBe(1);
		});

		it('should save multiple records from different types', async () => {
			const firstNode = testUtils.makeNode([label1]);
			const secondNode = testUtils.makeNode([label1]);
			const relationship = testUtils.makeRelationship(relationshipType, firstNode, secondNode);
			testUtils.mockNormalRunSubscribe([
				testUtils.makeRecord([testUtils.makePathFromNodes([
					testUtils.makeNode([label1]),
					testUtils.makeNode([label1])
				], relationshipType)]),
				testUtils.makeRecord([testUtils.makeNode([label1])]),
				testUtils.makeRecord([firstNode, secondNode, relationship])
			]);
			neovis.render();
			await testUtils.neovisRenderDonePromise(neovis);
			expect(neovis._data.nodes.length).toBe(5);
			expect(neovis._data.edges.length).toBe(2);
		});
	});

	describe('neovis with sizeCypher', () => {
		const sizeCypher = 'sizeCypher';
		const neovisConfig = {
			initial_cypher,
			container_id,
			labels: {
				[label1]: {
					sizeCypher: sizeCypher
				}
			}
		};
		beforeEach(() => {
			neovis = new Neovis(neovisConfig);
		});

		it('should call sizeCypher and save return value to data set value', async () => {
			const node = testUtils.makeNode([label1]);
			testUtils.mockFullRunSubscribe({
				[initial_cypher]: {
					default: [testUtils.makeRecord([node])]
				},
				[sizeCypher]: {
					[node.identity.toInt()]: [testUtils.makeRecord([Neo4j.int(1)])]
				}
			});

			neovis.render();
			await testUtils.neovisRenderDonePromise(neovis);
			expect(Neo4jMock.mockSessionRun).toHaveBeenCalledTimes(1 + 1); // once for initial cypher and once for the sizeCypher
			expect(neovis._data.nodes.get(1)).toHaveProperty('value', 1);
		});
	});
});
