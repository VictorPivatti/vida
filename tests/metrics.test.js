#!/usr/bin/env node
/**
 * V.I.D.A. — Testes de métricas
 * Valida valores calculados (não só ausência de crash).
 * Fase 1 do plano A+C: casos edge críticos e regressões conhecidas.
 *
 * Uso: node tests/metrics.test.js
 */
console.log('tests/metrics.test.js — Fase 1 pendente (ver plano A+C)');
console.log('Casos a implementar:');
console.log('  [ ] tEspMed usa p[18], não dhAtend−dhAcol');
console.log('  [ ] Teto 720 min (não 200)');
console.log('  [ ] returns72 virada de mês');
console.log('  [ ] returns72 taxa = eventos ÷ atendimentos');
console.log('  [ ] monthlyStats campos k/vol/medOk/medN');
console.log('  [ ] metaManchester por cor');
console.log('  [ ] dateKey plantão noturno (00h–06h → dia anterior)');
console.log('  [ ] prevVal com <50% meses → null');
console.log('  [ ] evasaoDisponivel com/sem tipo_entrada');
console.log('');
console.log('OK (placeholder — implementar na Fase 1)');
process.exit(0);
