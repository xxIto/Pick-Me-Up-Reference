import { useRef, useState } from 'react';
import { Activity, Ban, Download, FlaskConical, Play } from 'lucide-react';
import { Badge, Button, Card, ProgressBar } from '../../components/ui/index.tsx';
import { createExperiment, simulationPopulations, simulationScenarios } from './data/experiments.ts';
import { runSimulationExperimentAsync } from './domain/runner.ts';
import { compareSimulationReports } from './domain/reporting.ts';
import { SUPPORTED_SIMULATION_BATCHES } from './domain/types.ts';
import type { SimulationReport } from './domain/types.ts';

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#5f5875]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#F4F1FA]">{value}</p>
      {detail && <p className="mt-1 text-[10px] text-[#918BA5]">{detail}</p>}
    </Card>
  );
}

export function SimulationLabPage() {
  const [scenarioId, setScenarioId] = useState(simulationScenarios[0]?.id ?? '');
  const [populationId, setPopulationId] = useState(simulationPopulations[0]?.id ?? '');
  const [count, setCount] = useState<number>(SUPPORTED_SIMULATION_BATCHES[0]);
  const [baseSeed, setBaseSeed] = useState(13_337);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [comparisonBaseline, setComparisonBaseline] = useState<SimulationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancellation = useRef(false);

  const run = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    setProgress(0);
    cancellation.current = false;
    try {
      const experiment = createExperiment({
        id: `ui:${populationId}:${scenarioId}:${baseSeed}:${count}`,
        scenarioId, populationId, count, baseSeed,
        traceLimit: 3, maxDecisionsPerTrace: 50, debugTracing: true,
      });
      const result = await runSimulationExperimentAsync(experiment, {
        chunkSize: count >= 1_000 ? 10 : 5,
        isCancelled: () => cancellation.current,
        onProgress: (update) => setProgress(update.fraction),
      });
      setReport(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  const exportReport = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report.reportId.replaceAll(':', '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const comparison = report && comparisonBaseline && report.reportId !== comparisonBaseline.reportId
    ? compareSimulationReports(comparisonBaseline, report)
    : null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-violet-300">
            <FlaskConical size={18} />
            <p className="text-xs font-bold uppercase tracking-[0.2em]">Developer Tool</p>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-[#F4F1FA] sm:text-3xl">AI Simulation Laboratory</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#918BA5]">
            Reproducible, isolated combat experiments. Results never update the player roster or save data.
          </p>
        </div>
        <Badge label="Internal · No Persistence" variant="class" />
      </header>

      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-[#918BA5]">
            Scenario
            <select value={scenarioId} disabled={running} onChange={(event) => setScenarioId(event.target.value)} className="mt-2 w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2.5 text-[#F4F1FA]">
              {simulationScenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#918BA5]">
            Party configuration
            <select value={populationId} disabled={running} onChange={(event) => setPopulationId(event.target.value)} className="mt-2 w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2.5 text-[#F4F1FA]">
              {simulationPopulations.map((population) => <option key={population.id} value={population.id}>{population.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#918BA5]">
            Battles
            <select value={count} disabled={running} onChange={(event) => setCount(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2.5 text-[#F4F1FA]">
              {SUPPORTED_SIMULATION_BATCHES.map((size) => <option key={size} value={size}>{size.toLocaleString()}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#918BA5]">
            Base seed
            <input type="number" value={baseSeed} disabled={running} onChange={(event) => setBaseSeed(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-[#2e2a44] bg-[#0f0d1f] px-3 py-2.5 text-[#F4F1FA]" />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button disabled={running} onClick={run} leftIcon={<Play size={15} />}>Run Experiment</Button>
          {running && (
            <Button variant="secondary" onClick={() => { cancellation.current = true; }} leftIcon={<Ban size={15} />}>
              Cancel
            </Button>
          )}
          {report && <Button variant="gold" onClick={exportReport} leftIcon={<Download size={15} />}>Export JSON</Button>}
          {report && (
            <Button variant="secondary" onClick={() => setComparisonBaseline(report)}>
              Set Comparison Baseline
            </Button>
          )}
          <p className="text-[10px] text-[#5f5875]">10,000-battle analysis is supported but Node execution is preferred for performance.</p>
        </div>
        {running && <ProgressBar value={Math.round(progress * 100)} max={100} color="violet" label="Simulation progress" showLabel className="mt-4" />}
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</p>}
      </Card>

      {report && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Win Rate" value={percent(report.metrics.winRate.rate)} detail={`95% CI ${percent(report.metrics.winRate.lower)}–${percent(report.metrics.winRate.upper)}`} />
            <MetricCard label="Survival Rate" value={percent(report.metrics.survivalRate.rate)} detail={`${report.metrics.survivalRate.count}/${report.metrics.survivalRate.total} heroes`} />
            <MetricCard label="Average Rounds" value={report.metrics.averageRounds.toFixed(2)} />
            <MetricCard label="Avg. Damage" value={report.metrics.averageDamageDealt.toFixed(1)} />
            <MetricCard label="Runtime" value={`${report.metrics.runtimeMs.toFixed(1)} ms`} detail={`${report.metrics.averageRuntimePerBattleMs.toFixed(3)} ms/battle`} />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-violet-300" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Behavior Metrics</h2>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Effective healing', report.metrics.averageEffectiveHealing],
                  ['Wasted healing', report.metrics.averageWastedHealing],
                  ['Defend frequency', percent(report.metrics.defendFrequency)],
                  ['Strategy adherence', report.metrics.strategyAdherence.total > 0 ? percent(report.metrics.strategyAdherence.rate) : 'N/A'],
                  ['Memory mean', report.metrics.memoryContribution.mean],
                  ['Relationship mean', report.metrics.relationshipContribution.mean],
                  ['Leadership mean', report.metrics.leadershipContribution.mean],
                  ['Invalid actions', report.metrics.invalidActionCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-[#0f0d1f] p-3">
                    <dt className="text-[#5f5875]">{label}</dt>
                    <dd className="mt-1 font-bold text-[#D6B36A]">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Selected Battle Diagnostics</h2>
              {report.traces.length === 0 ? (
                <p className="mt-4 text-xs text-[#918BA5]">Debug tracing was disabled or no trace was retained.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {report.traces.map((trace) => (
                    <details key={trace.seed} className="rounded-lg border border-[#2a2540] bg-[#0f0d1f] p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-[#F4F1FA]">Seed {trace.seed} · {trace.outcome} · {trace.rounds} rounds</summary>
                      {trace.warnings.map((warning) => <p key={warning} className="mt-2 text-[10px] text-amber-300">{warning}</p>)}
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                        {trace.decisions.map((decision, index) => (
                          <div key={`${decision.heroInstanceId}:${index}`} className="rounded bg-[#171426] p-2 text-[10px] text-[#918BA5]">
                            <p className="font-semibold text-[#B8B1C9]">{decision.heroInstanceId} → {decision.selectedAction.skillId ?? decision.selectedAction.type} ({decision.selectedUtility})</p>
                            <p>{decision.alternatives.length} legal candidates · target {decision.selectedAction.targetId}</p>
                            {decision.warnings.map((warning) => <p key={warning} className="text-amber-300">{warning}</p>)}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {comparison && (
            <Card className="p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Matched Comparison</h2>
              <p className="mt-1 text-xs text-[#918BA5]">
                Baseline {comparisonBaseline?.configuration.population.label} → {report.configuration.population.label}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {Object.entries(comparison.absoluteDifferences).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-[#0f0d1f] p-3">
                    <p className="text-[9px] uppercase tracking-wide text-[#5f5875]">{label}</p>
                    <p className={`mt-1 text-sm font-bold ${value >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{value > 0 ? '+' : ''}{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-[#918BA5]">
                {comparison.matchedSeeds ? `Matched seeds · n=${comparison.sampleSize}` : 'Seed sets differ; causal interpretation is weaker.'}
              </p>
              {comparison.warnings.map((warning) => <p key={warning} className="mt-1 text-[10px] text-amber-300">{warning}</p>)}
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Balancing Report</h2>
            {report.balancingReport.executiveSummary.map((finding) => (
              <p key={finding} className="mt-2 text-xs leading-5 text-[#B8B1C9]">• {finding}</p>
            ))}
            <h3 className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#D6B36A]">Evidence-gated recommendations</h3>
            {report.balancingReport.recommendations.map((recommendation) => (
              <p key={recommendation} className="mt-2 text-xs leading-5 text-[#918BA5]">• {recommendation}</p>
            ))}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#F4F1FA]">Warnings & Limitations</h2>
            {[...report.warnings, ...report.limitations].map((warning) => (
              <p key={warning} className="mt-2 text-xs leading-5 text-[#918BA5]">• {warning}</p>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
