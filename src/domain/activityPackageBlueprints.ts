import { StandardPackageDraftInput, StandardParameterType } from '../services/standardPackageService';

type ParameterSpec = { key: string; name: string; type: StandardParameterType; options?: string[] };
type RequirementSpec = { key: string; name: string; description: string; parameters: ParameterSpec[] };
type SessionSpec = { title: string; objective: string; requirementKey: string; parameterKey: string; outcome: string };
type LevelSpec = { key: string; name: string; description: string; requirements: RequirementSpec[]; sessions: SessionSpec[] };
type ActivitySpec = {
  slug: string; name: string; description: string; organizationTypes: string[];
  programName: string; programDescription: string; methodology: string; levels: LevelSpec[];
};

const build = (spec: ActivitySpec): StandardPackageDraftInput => ({
  slug: spec.slug,
  name: spec.name,
  description: spec.description,
  version: 1,
  organizationTypes: spec.organizationTypes,
  definition: {
    programs: [{
      key: spec.slug.replace(/-foundation$/, ''),
      name: spec.programName,
      description: spec.programDescription,
      displayOrder: 1,
      levels: spec.levels.map((level, levelIndex) => ({
        key: level.key,
        name: level.name,
        description: level.description,
        sequence: levelIndex + 1,
        requirements: level.requirements.map((requirement, requirementIndex) => ({
          ...requirement,
          sequence: requirementIndex + 1,
          isRequired: true,
          parameters: requirement.parameters.map((parameter, parameterIndex) => ({
            ...parameter,
            sequence: parameterIndex + 1,
            isRequired: true
          }))
        }))
      })),
      roadmaps: spec.levels.map(level => ({
        key: `${level.key}-roadmap`,
        levelKey: level.key,
        name: `${level.name} Roadmap`,
        version: 1,
        methodology: spec.methodology,
        plannedSessions: level.sessions.map((session, sessionIndex) => ({
          sequence: sessionIndex + 1,
          title: session.title,
          description: session.objective,
          methodology: spec.methodology,
          expectedOutcomes: [session.outcome],
          objectives: [{
            sequence: 1,
            title: session.objective,
            expectedOutcome: session.outcome,
            requirementKey: session.requirementKey,
            parameterKey: session.parameterKey
          }]
        }))
      }))
    }]
  }
});

const specs: ActivitySpec[] = [
  {
    slug: 'swimming-foundation', name: 'Children’s Swimming Foundation',
    description: 'Water confidence, safety and early independent swimming.',
    organizationTypes: ['sports_club', 'training_academy', 'fitness_business'],
    programName: 'Learn to Swim', programDescription: 'A progressive foundation in water safety and swimming skills.',
    methodology: 'Demonstration, supported practice and gradual reduction of assistance.',
    levels: [
      { key: 'water-confidence', name: 'Water Confidence', description: 'Safe entry, breathing and supported buoyancy.', requirements: [
        { key: 'safe-water-entry', name: 'Safe Water Entry', description: 'Enter and leave the pool safely.', parameters: [{ key: 'entry-complete', name: 'Safe entry completed', type: 'checkbox' }] },
        { key: 'supported-floating', name: 'Supported Floating', description: 'Relax in front and back floating positions.', parameters: [{ key: 'float-duration', name: 'Supported float duration (seconds)', type: 'number' }] }
      ], sessions: [
        { title: 'Safe Entry and Exit', objective: 'Use a controlled pool entry and safe exit.', requirementKey: 'safe-water-entry', parameterKey: 'entry-complete', outcome: 'Completes entry and exit with agreed support.' },
        { title: 'Front and Back Floating', objective: 'Maintain supported front and back floats.', requirementKey: 'supported-floating', parameterKey: 'float-duration', outcome: 'Floats calmly for an age-appropriate duration.' }
      ] },
      { key: 'independent-movement', name: 'Independent Movement', description: 'Propulsion, breathing and short independent travel.', requirements: [
        { key: 'streamlined-travel', name: 'Streamlined Travel', description: 'Travel independently in a balanced body position.', parameters: [{ key: 'travel-distance', name: 'Independent distance (metres)', type: 'number' }] },
        { key: 'breathing-control', name: 'Breathing Control', description: 'Coordinate exhalation and recovery breathing.', parameters: [{ key: 'breathing-rating', name: 'Breathing control', type: 'rating' }] }
      ], sessions: [
        { title: 'Push and Glide', objective: 'Push, glide and maintain a streamlined position.', requirementKey: 'streamlined-travel', parameterKey: 'travel-distance', outcome: 'Travels independently with stable alignment.' },
        { title: 'Breathing and Recovery', objective: 'Coordinate breathing during short-distance movement.', requirementKey: 'breathing-control', parameterKey: 'breathing-rating', outcome: 'Uses controlled exhalation and recovery breathing.' }
      ] }
    ]
  },
  {
    slug: 'karate-foundation', name: 'Children’s Karate Foundation',
    description: 'Dojo conduct, foundational stances and controlled technique.',
    organizationTypes: ['sports_club', 'training_academy', 'fitness_business'],
    programName: 'Karate Fundamentals', programDescription: 'Safe, respectful progression through foundational karate skills.',
    methodology: 'Model technique, practise slowly, then apply with control and respectful partner work.',
    levels: [
      { key: 'dojo-beginner', name: 'Dojo Beginner', description: 'Etiquette, posture and basic movement.', requirements: [
        { key: 'dojo-conduct', name: 'Dojo Conduct', description: 'Follow safety, listening and respect routines.', parameters: [{ key: 'conduct-consistent', name: 'Conduct routine completed', type: 'checkbox' }] },
        { key: 'basic-stance', name: 'Basic Stance', description: 'Show balanced posture and foot placement.', parameters: [{ key: 'stance-control', name: 'Stance control', type: 'rating' }] }
      ], sessions: [
        { title: 'Respect and Readiness', objective: 'Demonstrate bowing, listening and safe spacing.', requirementKey: 'dojo-conduct', parameterKey: 'conduct-consistent', outcome: 'Participates safely and respectfully.' },
        { title: 'Stable Stances', objective: 'Form and hold a balanced foundational stance.', requirementKey: 'basic-stance', parameterKey: 'stance-control', outcome: 'Maintains alignment during simple movement.' }
      ] },
      { key: 'controlled-technique', name: 'Controlled Technique', description: 'Coordinated blocks and strikes with control.', requirements: [
        { key: 'basic-block', name: 'Basic Block', description: 'Perform a clear block with correct path.', parameters: [{ key: 'block-quality', name: 'Block quality', type: 'select', options: ['Needs support', 'Developing', 'Consistent'] }] },
        { key: 'controlled-strike', name: 'Controlled Strike', description: 'Strike a target safely with focus and recovery.', parameters: [{ key: 'strike-control', name: 'Strike control', type: 'rating' }] }
      ], sessions: [
        { title: 'Blocking Path', objective: 'Perform a basic block with a controlled path.', requirementKey: 'basic-block', parameterKey: 'block-quality', outcome: 'Shows correct preparation, path and finish.' },
        { title: 'Target Control', objective: 'Deliver and recover a controlled target strike.', requirementKey: 'controlled-strike', parameterKey: 'strike-control', outcome: 'Maintains distance, control and safe recovery.' }
      ] }
    ]
  },
  {
    slug: 'gymnastics-foundation', name: 'Children’s Gymnastics Foundation',
    description: 'Body shapes, balance, safe landings and introductory movement.',
    organizationTypes: ['sports_club', 'training_academy', 'fitness_business'],
    programName: 'Gymnastics Fundamentals', programDescription: 'Progressive strength, balance and movement foundations.',
    methodology: 'Use safe stations, progressive shaping and supported attempts before independent performance.',
    levels: [
      { key: 'movement-foundations', name: 'Movement Foundations', description: 'Core shapes, balance and landing safety.', requirements: [
        { key: 'body-shapes', name: 'Core Body Shapes', description: 'Show tuck, pike, straddle and straight shapes.', parameters: [{ key: 'shape-quality', name: 'Shape quality', type: 'rating' }] },
        { key: 'safe-landing', name: 'Safe Landing', description: 'Land with balance and controlled knees.', parameters: [{ key: 'landing-complete', name: 'Safe landing completed', type: 'checkbox' }] }
      ], sessions: [
        { title: 'Shapes and Tension', objective: 'Demonstrate clear foundational body shapes.', requirementKey: 'body-shapes', parameterKey: 'shape-quality', outcome: 'Shows recognizable shapes with body tension.' },
        { title: 'Landing Safely', objective: 'Land from a low jump with control.', requirementKey: 'safe-landing', parameterKey: 'landing-complete', outcome: 'Absorbs landing and holds a balanced finish.' }
      ] },
      { key: 'balance-and-rotation', name: 'Balance and Rotation', description: 'Static balance and introductory rolling actions.', requirements: [
        { key: 'static-balance', name: 'Static Balance', description: 'Hold a controlled balance position.', parameters: [{ key: 'balance-duration', name: 'Balance duration (seconds)', type: 'number' }] },
        { key: 'forward-roll', name: 'Forward Roll', description: 'Complete a safe rounded forward rotation.', parameters: [{ key: 'roll-stage', name: 'Forward roll stage', type: 'select', options: ['Supported', 'Independent with cues', 'Independent'] }] }
      ], sessions: [
        { title: 'Balance Shapes', objective: 'Hold a stable balance with controlled alignment.', requirementKey: 'static-balance', parameterKey: 'balance-duration', outcome: 'Maintains balance for an appropriate duration.' },
        { title: 'Rounded Rotation', objective: 'Perform a safe progressive forward roll.', requirementKey: 'forward-roll', parameterKey: 'roll-stage', outcome: 'Rotates with a rounded shape and safe finish.' }
      ] }
    ]
  },
  {
    slug: 'dance-foundation', name: 'Children’s Dance Foundation',
    description: 'Rhythm, movement vocabulary, sequencing and expression.',
    organizationTypes: ['arts_studio', 'training_academy'],
    programName: 'Dance Foundations', programDescription: 'Musical, physical and expressive foundations for young dancers.',
    methodology: 'Explore through demonstration, guided improvisation and short repeatable sequences.',
    levels: [
      { key: 'rhythm-and-movement', name: 'Rhythm and Movement', description: 'Move safely with pulse, space and body awareness.', requirements: [
        { key: 'steady-pulse', name: 'Steady Pulse', description: 'Coordinate movement with a steady musical pulse.', parameters: [{ key: 'rhythm-consistency', name: 'Rhythm consistency', type: 'rating' }] },
        { key: 'spatial-awareness', name: 'Spatial Awareness', description: 'Use personal and shared space safely.', parameters: [{ key: 'space-observation', name: 'Teacher observation', type: 'text' }] }
      ], sessions: [
        { title: 'Move to the Beat', objective: 'Repeat movements in time with a steady pulse.', requirementKey: 'steady-pulse', parameterKey: 'rhythm-consistency', outcome: 'Maintains the pulse through a short phrase.' },
        { title: 'Pathways and Space', objective: 'Travel using pathways while maintaining safe space.', requirementKey: 'spatial-awareness', parameterKey: 'space-observation', outcome: 'Moves with awareness of boundaries and others.' }
      ] },
      { key: 'sequence-and-expression', name: 'Sequence and Expression', description: 'Remember phrases and communicate an expressive intention.', requirements: [
        { key: 'movement-sequence', name: 'Movement Sequence', description: 'Recall and perform a short movement phrase.', parameters: [{ key: 'sequence-stage', name: 'Sequence recall', type: 'select', options: ['With full support', 'With prompts', 'Independently'] }] },
        { key: 'expressive-choice', name: 'Expressive Choice', description: 'Use energy, shape or focus to communicate an idea.', parameters: [{ key: 'expression-observation', name: 'Expression observation', type: 'text' }] }
      ], sessions: [
        { title: 'Build a Phrase', objective: 'Recall and perform a short movement sequence.', requirementKey: 'movement-sequence', parameterKey: 'sequence-stage', outcome: 'Performs the phrase in the correct order.' },
        { title: 'Movement with Meaning', objective: 'Apply an expressive choice to the phrase.', requirementKey: 'expressive-choice', parameterKey: 'expression-observation', outcome: 'Communicates a clear movement intention.' }
      ] }
    ]
  },
  {
    slug: 'montessori-foundation', name: 'Montessori Early Learning Foundation',
    description: 'Practical life, concentration, independence and early sensorial sequencing.',
    organizationTypes: ['early_childhood_center', 'school', 'training_academy'],
    programName: 'Montessori Foundations', programDescription: 'Observation-led development through purposeful independent work.',
    methodology: 'Present slowly, observe without interruption and support repetition toward independence.',
    levels: [
      { key: 'practical-life-emerging', name: 'Practical Life — Emerging', description: 'Care of self, environment and work-cycle routines.', requirements: [
        { key: 'work-cycle', name: 'Work-Cycle Routine', description: 'Choose, complete and restore an activity.', parameters: [{ key: 'independent-cycle', name: 'Completes work cycle independently', type: 'checkbox' }] },
        { key: 'concentration', name: 'Concentration', description: 'Sustain purposeful engagement with chosen work.', parameters: [{ key: 'engagement-duration', name: 'Engagement duration (minutes)', type: 'number' }] }
      ], sessions: [
        { title: 'Choosing and Restoring Work', objective: 'Complete the choose–work–restore sequence.', requirementKey: 'work-cycle', parameterKey: 'independent-cycle', outcome: 'Completes the routine with decreasing adult support.' },
        { title: 'Sustained Practical Work', objective: 'Remain engaged in a practical-life activity.', requirementKey: 'concentration', parameterKey: 'engagement-duration', outcome: 'Sustains purposeful attention for an observed period.' }
      ] },
      { key: 'sensorial-sequencing', name: 'Sensorial Sequencing', description: 'Discrimination, ordering and self-correction.', requirements: [
        { key: 'graded-sequence', name: 'Graded Sequence', description: 'Order materials by one visible quality.', parameters: [{ key: 'sequence-completion', name: 'Sequence completed (%)', type: 'percentage' }] },
        { key: 'self-correction', name: 'Self-Correction', description: 'Notice and respond to the material’s control of error.', parameters: [{ key: 'correction-observation', name: 'Observation of self-correction', type: 'text' }] }
      ], sessions: [
        { title: 'Ordering by Dimension', objective: 'Build a graded sequence using one dimension.', requirementKey: 'graded-sequence', parameterKey: 'sequence-completion', outcome: 'Orders the material with increasing accuracy.' },
        { title: 'Notice and Correct', objective: 'Use feedback from the material to revise work.', requirementKey: 'self-correction', parameterKey: 'correction-observation', outcome: 'Recognizes and corrects an error with reduced prompting.' }
      ] }
    ]
  }
];

export const activityPackageBlueprints: StandardPackageDraftInput[] = specs.map(build);
export const copyActivityPackageBlueprint = (slug: string): StandardPackageDraftInput | undefined => {
  const blueprint = activityPackageBlueprints.find(item => item.slug === slug);
  return blueprint ? JSON.parse(JSON.stringify(blueprint)) : undefined;
};
