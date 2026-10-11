const sameId = (left, right) => String(left?._id || left || '') === String(right?._id || right || '');

function supportsProgramAndLevel(group, programId, levelId) {
  if (group?.programId && !sameId(group.programId, programId)) return false;
  const levelIds = Array.isArray(group?.levelIds) ? group.levelIds : [];
  if (levelIds.length > 0 && (!levelId || !levelIds.some(id => sameId(id, levelId)))) return false;
  return true;
}

module.exports = { supportsProgramAndLevel };
