(function (root) {
  function isValidTimeRange(startTime, endTime) {
    if (!startTime && !endTime) return true;
    const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
    return Boolean(time.test(startTime) && time.test(endTime) && endTime > startTime);
  }

  function sortTasksByTime(tasks) {
    return [...tasks].sort((a, b) => {
      const aTime = a.startTime || '99:99';
      const bTime = b.startTime || '99:99';
      return aTime.localeCompare(bTime);
    });
  }

  function timeLabel(task) {
    return task.startTime && task.endTime
      ? `${task.startTime}–${task.endTime}`
      : '未排時段';
  }

  root.PlannerTime = { isValidTimeRange, sortTasksByTime, timeLabel };
})(globalThis);
