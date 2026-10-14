// Loading skeletons shaped like each page: the page's own layout classes,
// with grey bars where the words and pictures will be, so nothing moves
// when the real content arrives.

const Bar = ({ w = '100%', h = 12, r }) => <span className="sk-bar" style={{ width: w, height: h, ...(r ? { borderRadius: r } : {}) }} />;
const Dot = ({ s = 40, r = '50%' }) => <span className="sk-bar" style={{ width: s, height: s, borderRadius: r, flexShrink: 0 }} />;
const Lines = ({ widths, h = [15, 11], gap = 7 }) => (
  <span className="sk-col" style={{ gap }}>
    {widths.map((w, i) => (
      <Bar key={i} w={w} h={h[i] ?? h[h.length - 1]} />
    ))}
  </span>
);
const Busy = ({ label = 'Loading', children }) => (
  <div className="sk sk-shaped" role="status" aria-busy="true" aria-label={label}>
    {children}
  </div>
);
const W = ['62%', '48%', '70%', '55%', '66%', '44%', '58%'];

// ---------------------------------------------------------------- mentoring tree
export function TreeSkeleton() {
  const person = (i) => (
    <div className="tree-item" key={i}>
      <div className="tree-node sk-node">
        <Dot s={40} />
        <div className="mentor-body">
          <Lines widths={[W[i % 7], '38%']} />
        </div>
        <Dot s={38} />
      </div>
    </div>
  );
  return (
    <Busy label="Loading your mentoring tree">
      <div className="tree-counts">
        {[0, 1, 2].map((i) => (
          <span key={i} className="sk-col center">
            <Bar w={22} h={20} />
            <Bar w={46} h={10} />
          </span>
        ))}
      </div>
      <div className="tree">
        <div className="tree-node mentor sk-node">
          <Dot s={46} />
          <div className="mentor-body">
            <Lines widths={['24%', '58%', '42%', '66%']} h={[9, 16, 11, 11]} />
          </div>
        </div>
        <div className="tree-branch">
          <div className="tree-caption">
            <Bar w="52%" h={10} />
          </div>
          {[0, 1, 2, 3].map(person)}
        </div>
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- a mentee's page
export function MenteeSkeleton() {
  return (
    <Busy label="Loading their updates">
      <div className="md-stack">
        <div className="card md-hero">
          <div className="md-hero-band sk-band" />
          <div className="md-hero-main">
            <Dot s={64} />
            <div className="md-hero-text">
              <Lines widths={['70%', '40%', '30%']} h={[20, 14, 26]} gap={9} />
            </div>
            <Dot s={58} />
          </div>
          <div className="md-stats">
            {[0, 1, 2].map((i) => (
              <div key={i} className="md-stat sk-col center">
                <Bar w={40} h={18} />
                <Bar w={70} h={9} />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="log-section-head">
            <Dot s={36} r={10} />
            <Lines widths={['46%', '30%']} />
          </div>
          <div className="md-items">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="md-item sk-row">
                <Dot s={34} r={10} />
                <Lines widths={[W[i], '22%']} h={[13, 10]} />
                <Dot s={22} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- timetable
export function TimetableSkeleton() {
  return (
    <Busy label="Loading your timetable">
      <div className="card now-card">
        <Dot s={42} r={12} />
        <div className="now-body">
          <Lines widths={['22%', '62%', '44%']} h={[9, 18, 11]} />
        </div>
      </div>
      <div className="range-toggle segmented timetable-view sk-seg">
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>
            <Bar w="56%" h={11} />
          </span>
        ))}
      </div>
      <div className="day-tabs">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="day-tab sk-col center">
            <Bar w="60%" h={8} />
            <Bar w="42%" h={15} />
            <Bar w="20%" h={8} />
          </div>
        ))}
      </div>
      <Bar w="52%" h={16} />
      <div className="class-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="class-card static sk-row">
            <span className="class-time sk-col">
              <Bar w={56} h={14} />
              <Bar w={44} h={10} />
            </span>
            <span className="class-body">
              <Lines widths={[W[i], '52%', '40%']} h={[15, 10, 10]} />
            </span>
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- academic journal: the week
export function JournalSkeleton() {
  return (
    <Busy label="Loading your week">
      <div className="card week-summary">
        <div className="aj-hero">
          <Dot s={84} />
          <div className="aj-hero-text">
            <Lines widths={['70%', '50%', '62%']} h={[18, 12, 12]} gap={9} />
          </div>
        </div>
        <div className="day-bars md-day-bars aj-day-bars">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="day-bar sk-col center">
              <Bar w="60%" h={[40, 62, 28, 70, 50, 20, 34][i]} r={6} />
              <Bar w="70%" h={9} />
            </div>
          ))}
        </div>
        <Bar w="36%" h={12} />
        <div className="aj-actions">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aj-action sk-col">
              <Dot s={32} r={10} />
              <Lines widths={['60%', '80%', '40%']} h={[14, 10, 10]} />
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- mentoring dashboard
export function DashboardSkeleton() {
  return (
    <Busy label="Loading the dashboard">
      <div className="card perf-overview">
        <div className="perf-hero">
          <Dot s={76} />
          <div className="perf-hero-text">
            <Lines widths={['64%', '40%', '52%']} h={[18, 11, 11]} gap={9} />
          </div>
        </div>
        <div className="perf-facts">
          {[0, 1, 2].map((i) => (
            <div key={i} className="perf-fact sk-col center">
              <Dot s={18} />
              <Bar w={44} h={18} />
              <Bar w={60} h={9} />
            </div>
          ))}
        </div>
      </div>
      <div className="card perf-group">
        <div className="perf-list-head">
          <Bar w="40%" h={14} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="perf-row sk-row">
            <Dot s={40} />
            <div className="perf-body">
              <Lines widths={[W[i], '80%', '64%']} h={[15, 10, 10]} />
            </div>
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- notifications
export function NotificationsSkeleton() {
  return (
    <Busy label="Loading your notifications">
      <div className="notif-group">
        <div className="notif-group-title">
          <Bar w={70} h={10} />
        </div>
        <div className="card notif-list">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="notif-item sk-row">
              <Dot s={34} />
              <span className="notif-text">
                <Lines widths={[W[i], '86%', '22%']} h={[14, 11, 9]} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- deadlines (dated cards)
export function DeadlinesSkeleton({ count = 4 }) {
  return (
    <Busy label="Loading the deadlines">
      <div className="md-deadlines dl-own">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="md-deadline sk-row">
            <span className="md-date sk-col center">
              <Bar w={26} h={9} />
              <Bar w={22} h={18} />
            </span>
            <div className="md-deadline-body">
              <Lines widths={['34%', W[i], '48%']} h={[10, 15, 10]} />
            </div>
            <Bar w={52} h={20} r={999} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- past year papers
export function PapersSkeleton() {
  return (
    <Busy label="Loading the papers">
      <div className="py-list">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="py-card sk-row">
            <Dot s={40} r={12} />
            <div className="py-body">
              <Lines widths={[W[i], '26%', '70%', '52%', '40%']} h={[16, 12, 10, 10, 10]} />
            </div>
            <div className="py-actions sk-col">
              <Bar w={56} h={28} r={999} />
            </div>
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- the list of surahs
export function SurahListSkeleton() {
  return (
    <Busy label="Loading the surahs">
      <div className="quran-list">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="quran-row sk-row">
            <Dot s={34} r={10} />
            <span className="quran-row-body">
              <Lines widths={[W[i], '46%']} h={[15, 10]} />
            </span>
            <Bar w={64} h={22} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- subjects
export function SubjectsSkeleton() {
  return (
    <Busy label="Loading your subjects">
      <div className="subject-cards">
        {[0, 1].map((i) => (
          <div key={i} className="card subject-card sk-col" style={{ gap: 14 }}>
            <div className="subject-card-head sk-row">
              <Dot s={44} r={12} />
              <Lines widths={[W[i], '30%']} h={[17, 11]} />
            </div>
            <div className="subject-facts sk-row" style={{ gap: 10 }}>
              {[0, 1, 2].map((j) => (
                <Bar key={j} w={70} h={22} r={999} />
              ))}
            </div>
            <Lines widths={['30%', '100%']} h={[10, 8]} />
            <div className="assessment-chips sk-row" style={{ gap: 8 }}>
              {[0, 1, 2].map((j) => (
                <Bar key={j} w={74} h={28} r={999} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- study groups
export function GroupsSkeleton() {
  return (
    <Busy label="Loading your study groups">
      <div className="group-cards">
        {[0, 1, 2].map((i) => (
          <div key={i} className="group-card sk-row">
            <Dot s={44} r={12} />
            <Lines widths={[W[i], '40%', '30%']} h={[16, 11, 10]} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- the day's checklist
export function ChecklistSkeleton() {
  return (
    <Busy label="Loading the day's checklist">
      {[3, 2, 2].map((n, g) => (
        <section key={g} className="checklist-group">
          <div className="checklist-group-head">
            <Bar w={90} h={11} />
          </div>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="checklist-item sk-row">
              <Dot s={38} r={12} />
              <Lines widths={[W[(g * 3 + i) % 7], '30%']} h={[14, 10]} />
              <Dot s={26} />
            </div>
          ))}
        </section>
      ))}
    </Busy>
  );
}

// ---------------------------------------------------------------- a study group room
export function RoomSkeleton() {
  return (
    <Busy label="Loading the group">
      <div className="page-header">
        <div className="sk-col" style={{ gap: 10 }}>
          <Bar w={64} h={26} r={999} />
          <Bar w={190} h={26} />
          <Bar w={130} h={12} />
        </div>
      </div>
      <div className="room-tabs">
        {[0, 1, 2].map((i) => (
          <span key={i} className="room-tab">
            <Bar w={54} h={11} />
          </span>
        ))}
      </div>
      <div className="card sk-col" style={{ gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`sk-row${i % 2 ? ' sk-right' : ''}`}>
            {i % 2 === 0 && <Dot s={30} />}
            <Bar w={['58%', '46%', '64%', '40%'][i]} h={40} r={14} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- the group's timetable
export function GroupTimetableSkeleton() {
  return (
    <Busy label="Loading everyone's timetable">
      <div className="card gt-card sk-col" style={{ gap: 12 }}>
        <div className="log-section-head">
          <Dot s={36} r={10} />
          <Lines widths={['50%', '70%']} />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="sk-row" style={{ gap: 10 }}>
            <Bar w={34} h={12} />
            <Bar w={W[i]} h={22} r={999} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

// ---------------------------------------------------------------- compilation: a card per category
export function CategoriesSkeleton() {
  return (
    <Busy label="Loading the compilation">
      {[0, 1, 2].map((c) => (
        <div key={c} className="card sk-col" style={{ gap: 14 }}>
          <Bar w={90} h={10} />
          {[0, 1].map((i) => (
            <div key={i} className="sk-col" style={{ gap: 8 }}>
              <Bar w={W[(c + i) % 7]} h={14} />
              <span className="sk-col right" style={{ gap: 8 }}>
                <Bar w="92%" h={18} />
                <Bar w="66%" h={18} />
              </span>
              <Bar w="54%" h={10} />
            </div>
          ))}
        </div>
      ))}
    </Busy>
  );
}
