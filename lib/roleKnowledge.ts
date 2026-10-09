import { containsPhrase } from './matchPhrase';

export interface RoleKnowledgeEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  tableContent?: string;
  keywords: string[];
  triggers: string[];
  priority?: 'low' | 'medium' | 'high';
  lastUpdated?: string;
}

export const roleKnowledge: RoleKnowledgeEntry[] = [
  {
    id: 'paralegal-role',
    title: 'What a Paralegal Does',
    category: 'Roles',
    content: `### What a paralegal does

A paralegal supports attorneys on legal matters. At Ardent, paralegals handle the work that keeps a case organized so the lawyer can focus on strategy and advice.

#### Day-to-day work
- Prepare and format legal documents
- Review files and keep records complete
- Track deadlines, hearings, and follow-ups
- Organize case files and retrieve documents
- Help with legal research and fact gathering
- Communicate with clients in a professional, confidential way
- Support litigation tasks such as case tracking and file management

#### What a paralegal does not do
A paralegal does not give legal advice, set case strategy, or represent the client in court. That work stays with the attorney. The paralegal carries out the supporting tasks the legal team assigns.

#### At Ardent
Paralegal support covers document preparation, case management, research, e-discovery, contract administration, and client communication for law firms and legal departments.`,
    keywords: ['paralegal', 'paralegal duties', 'paralegal job', 'what paralegals do'],
    triggers: [
      'what does a paralegal do', 'what do paralegals do', 'paralegal duties', 'paralegal job',
      'paralegal role', 'paralegal responsibilities', 'define paralegal', 'what is a paralegal',
      'paralegal work', 'paralegal tasks', 'paralegal'
    ],
    priority: 'high',
    lastUpdated: '2026-10-09'
  },
  {
    id: 'legal-assistant-role',
    title: 'Legal Assistant',
    category: 'Roles',
    content: `### Legal assistant

A legal assistant handles the administrative side of a legal team.

- Manage calendars, deadlines, and appointments
- Prepare routine correspondence and client updates
- Organize files and keep the office workflow moving
- Support attorneys and paralegals with clerical tasks

A paralegal usually does more document drafting, file review, and case support. A legal assistant is focused on scheduling, communication, and office administration.`,
    keywords: ['legal assistant', 'legal secretary', 'administrative support'],
    triggers: [
      'what does a legal assistant do', 'legal assistant', 'legal secretary',
      'what is a legal assistant', 'legal assistant duties', 'difference between paralegal and legal assistant'
    ],
    priority: 'high',
    lastUpdated: '2026-10-09'
  },
  {
    id: 'attorney-role',
    title: 'Attorney Role',
    category: 'Roles',
    content: `### What an attorney does on a personal injury case

The attorney is responsible for the legal decisions on the file.

- Evaluate whether to accept the case
- Give legal advice and set strategy
- Decide whether to settle or file a lawsuit
- Direct case managers and paralegals on the work to complete
- Represent the client with insurers, opposing counsel, and the court

Ardent's team supports that strategy. Case managers and paralegals coordinate treatment, documents, deadlines, and client updates. They do not replace the attorney.`,
    keywords: ['attorney', 'lawyer', 'counsel'],
    triggers: [
      'what does an attorney do', 'what does a lawyer do', 'attorney role', 'lawyer role',
      'what is an attorney', 'what is a lawyer', 'attorney duties', 'lawyer duties'
    ],
    priority: 'high',
    lastUpdated: '2026-10-09'
  },
  {
    id: 'cma-role',
    title: 'Case Manager Assistant',
    category: 'Roles',
    content: `### Case Manager Assistant (CMA)

A Case Manager Assistant supports case managers with the daily administration of a file.

- Give administrative and technical support to case managers
- Help with client communication
- Maintain case files and records
- Document case activity
- Use the case management system to keep tasks and deadlines current

At Ardent, CMA training is 1-3 weeks and covers case workflows, client communication, document organization, and deadline tracking.`,
    keywords: ['cma', 'case manager assistant', 'cma training'],
    triggers: [
      'what is a cma', 'what is cma', 'case manager assistant', 'what does a cma do',
      'cma job', 'cma role', 'cma duties', 'cma responsibilities', 'cma training'
    ],
    priority: 'high',
    lastUpdated: '2026-10-09'
  },
  {
    id: 'training-periods',
    title: 'Training Periods',
    category: 'Training',
    content: `### Training periods by role

Training length depends on the position and the client account.

- **Case Manager Assistants (CMA):** 1-3 weeks. Workflows, client communication, documents, and deadlines.
- **Human Resources:** 1-2 weeks. HR policies, employee relations, and compliance.
- **Medical Records:** 1-3 weeks. HIPAA, medical documentation, and record systems.
- **Speak Easy account:** 1 day. Account-specific procedures and communication.
- **BDJ account:** Depends on the role. Training is tailored to that position.

Every program includes hands-on practice, an assessment, and ongoing support.`,
    keywords: ['training', 'training period', 'onboarding', 'speak easy', 'bdj'],
    triggers: [
      'training period', 'how long is training', 'training duration', 'how long does training last',
      'cma training', 'hr training', 'medical records training', 'training',
      'speak easy', 'speak easy account', 'what is speak easy', 'bdj', 'bdj account', 'what is bdj'
    ],
    priority: 'high',
    lastUpdated: '2026-10-09'
  },
  {
    id: 'intake-specialist',
    title: 'Intake Specialist',
    category: 'Roles',
    content: `### Intake specialist

An intake specialist opens the file and collects what the team needs before case work starts.

- Take the first client information and accident details
- Check that the matter fits the account's intake criteria
- Send the welcome information and next-step instructions
- Open the file so case management, records, and representation letters can begin

Intake is the start of the case. Treatment, demands, and settlement come after the file is accepted.`,
    keywords: ['intake specialist', 'intake role', 'new client intake'],
    triggers: [
      'what does intake do', 'intake specialist', 'what is an intake specialist',
      'intake role', 'who handles intake', 'intake duties'
    ],
    priority: 'medium',
    lastUpdated: '2026-10-09'
  }
];

export function findRoleKnowledge(userMessage: string): RoleKnowledgeEntry | null {
  const message = userMessage.toLowerCase();
  const ranked = [...roleKnowledge].sort((left, right) => {
    const leftLength = Math.max(...left.triggers.map(trigger => trigger.length));
    const rightLength = Math.max(...right.triggers.map(trigger => trigger.length));
    return rightLength - leftLength;
  });

  for (const entry of ranked) {
    const hit = [...entry.triggers].sort((a, b) => b.length - a.length)
      .find(trigger => containsPhrase(message, trigger));
    if (hit) return entry;
  }

  return null;
}
