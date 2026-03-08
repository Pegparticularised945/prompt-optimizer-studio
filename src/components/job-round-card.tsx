interface JudgeRun {
  id: string
  judgeIndex: number
  score: number
  hasMaterialIssues: boolean
  summary: string
  findings: string[]
  suggestedChanges: string[]
}

export interface RoundCandidateView {
  id: string
  roundNumber: number
  optimizedPrompt: string
  strategy: 'preserve' | 'rebuild'
  scoreBefore: number
  averageScore: number
  majorChanges: string[]
  mve: string
  deadEndSignals: string[]
  aggregatedIssues: string[]
  judges: JudgeRun[]
}

export function JobRoundCard({
  candidate,
  expanded,
  onToggle,
}: {
  candidate: RoundCandidateView
  expanded: boolean
  onToggle: () => void
}) {
  const review = candidate.judges[0]

  return (
    <article className={`round-card compact-round round-card-minimal${expanded ? ' expanded' : ''}`}>
      <div className="round-header">
        <div className="inline-actions">
          <span className="pill running">第 {candidate.roundNumber} 轮</span>
          <span className="pill completed">复核分数 {candidate.averageScore.toFixed(2)}</span>
          <span className={`pill ${review?.hasMaterialIssues ? 'manual_review' : 'completed'}`}>
            {review?.hasMaterialIssues ? '需继续优化' : '本轮通过'}
          </span>
        </div>
        <button className="button ghost" type="button" onClick={onToggle}>
          {expanded ? '收起详情' : '查看详情'}
        </button>
      </div>
      <div className="round-diagnostic-preview">
        <p className="small round-preview">{review?.summary ?? '暂无复核摘要。'}</p>
        {!expanded ? (
          <p className="meta round-hint">展开后可查看完整诊断信息。</p>
        ) : null}
      </div>
      {expanded ? (
        <div className="shell round-diagnostic-body">
          <details className="fold-card" open>
            <summary>查看优化后提示词</summary>
            <pre className="pre compact">{candidate.optimizedPrompt}</pre>
          </details>
          <div className="panel-grid">
            <div>
              <strong>主要修改</strong>
              <ul className="list compact-list">
                {candidate.majorChanges.map((item, index) => <li key={`${candidate.id}-major-${index}`}>{item}</li>)}
              </ul>
            </div>
            <div>
              <strong>MVE</strong>
              <p className="small">{candidate.mve}</p>
            </div>
            <div>
              <strong>死胡同信号</strong>
              <ul className="list compact-list">
                {candidate.deadEndSignals.map((item, index) => <li key={`${candidate.id}-signal-${index}`}>{item}</li>)}
              </ul>
            </div>
            <div>
              <strong>修订补丁</strong>
              <ul className="list compact-list">
                {candidate.aggregatedIssues.map((item, index) => <li key={`${candidate.id}-issue-${index}`}>{item}</li>)}
              </ul>
            </div>
          </div>
          {review ? (
            <div className="judge-card">
              <div className="card-header">
                <strong>复核结果</strong>
                <span className={`status ${review.hasMaterialIssues ? 'manual_review' : 'completed'}`}>{review.score}</span>
              </div>
              <strong>发现的问题</strong>
              <ul className="list compact-list">
                {review.findings.map((item, index) => <li key={`${review.id}-finding-${index}`}>{item}</li>)}
              </ul>
              <strong>建议修改</strong>
              <ul className="list compact-list">
                {review.suggestedChanges.map((item, index) => <li key={`${review.id}-suggestion-${index}`}>{item}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
