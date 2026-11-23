(() => {
  'use strict';

  const form = document.querySelector('#sleep-form');
  const message = document.querySelector('#form-message');
  const results = document.querySelector('#results');
  const intervalList = document.querySelector('#interval-list');
  const timeline = document.querySelector('#timeline');
  const copyStatus = document.querySelector('#copy-status');
  let lastAwakeDistribution = null;
  let generatedIntervals = [];

  const value = (id) => document.querySelector(`#${id}`).value;
  const durationLabel = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) return `${hours}h ${remainder}m`;
    if (hours) return `${hours}h`;
    return `${remainder}m`;
  };

  function readDuration(stage) {
    const rawHours = value(`${stage}-hours`);
    const rawMinutes = value(`${stage}-minutes`);
    if (rawHours === '' || rawMinutes === '') throw new Error(`Enter both hours and minutes for ${stage.toUpperCase()}.`);
    const hours = Number(rawHours);
    const minutes = Number(rawMinutes);
    if (!Number.isSafeInteger(hours) || hours < 0 || !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 59) {
      throw new Error(`${stage.toUpperCase()} hours must be zero or more, and minutes must be between 0 and 59.`);
    }
    const totalMinutes = hours * 60 + minutes;
    if (!Number.isSafeInteger(totalMinutes)) throw new Error(`${stage.toUpperCase()} duration is too large.`);
    return totalMinutes;
  }

  function readInputs() {
    const startDate = value('start-date');
    const startTime = value('start-time');
    const endDate = value('end-date');
    const endTime = value('end-time');
    if (!startDate || !startTime || !endDate || !endTime) throw new Error('Enter a start date and time, and an end date and time.');
    // Parse local wall time explicitly; elapsed duration then comes from epoch milliseconds.
    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('Enter valid sleep start and end dates and times.');
    const windowMinutesExact = (end.getTime() - start.getTime()) / 60000;
    if (windowMinutesExact <= 0) throw new Error('Sleep end must be later than sleep start.');
    if (!Number.isInteger(windowMinutesExact)) throw new Error('The sleep window must resolve to whole minutes.');
    const stages = { Core: readDuration('core'), Deep: readDuration('deep'), REM: readDuration('rem') };
    const awakeMinutes = readDuration('awake');
    const wakeCountRaw = value('wake-count');
    if (wakeCountRaw === '') throw new Error('Enter how many times you woke up.');
    const wakeCount = Number(wakeCountRaw);
    if (!Number.isSafeInteger(wakeCount) || wakeCount < 0 || wakeCount > 4) throw new Error('Wake-up count must be between 0 and 4.');
    const stageTotal = Object.values(stages).reduce((sum, duration) => sum + duration, 0);
    if (!Number.isSafeInteger(stageTotal + awakeMinutes)) throw new Error('Combined duration is too large.');
    const windowMinutes = windowMinutesExact;
    const totalEntered = stageTotal + awakeMinutes;
    if (totalEntered > windowMinutes) throw new Error('Stage and awake durations exceed the sleep window. Reduce one or more durations.');
    if (totalEntered < windowMinutes) throw new Error('Stage and awake durations must add up exactly to the sleep window.');
    if (awakeMinutes === 0 && wakeCount !== 0) throw new Error('Set wake-up count to 0 when awake time is 0.');
    if (awakeMinutes > 0 && wakeCount === 0) throw new Error('Enter at least 1 wake-up when awake time is greater than 0.');
    if (wakeCount > awakeMinutes) throw new Error('Each wake-up needs at least 1 minute of awake time.');
    return { start, end, windowMinutes, stages, awakeMinutes, wakeCount };
  }

  // Place the requested number of positive awake intervals in distinct gaps.
  // Randomly split the total while guaranteeing at least one minute per interval.
  function distributeAwake(total, count) {
    if (count === 0) return [0, 0, 0, 0];
    let distribution = null;
    let attempts = 0;
    while (attempts < 12) {
      attempts += 1;
      const slots = [0, 1, 2, 3];
      for (let index = slots.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [slots[index], slots[swapIndex]] = [slots[swapIndex], slots[index]];
      }
      const activeSlots = slots.slice(0, count);
      const remainder = total - count;
      const cuts = Array.from({ length: count - 1 }, () => Math.floor(Math.random() * (remainder + 1))).sort((a, b) => a - b);
      const points = [0, ...cuts, remainder];
      const parts = Array.from({ length: count }, (_, index) => points[index + 1] - points[index] + 1);
      const candidate = [0, 0, 0, 0];
      activeSlots.forEach((slot, index) => { candidate[slot] = parts[index]; });
      distribution = candidate;
      if (!lastAwakeDistribution || !candidate.every((part, index) => part === lastAwakeDistribution[index])) break;
    }
    // A fallback guarantees a different result when another arrangement exists.
    if (lastAwakeDistribution && distribution.every((part, index) => part === lastAwakeDistribution[index])) {
      const inactiveSlot = distribution.findIndex((part) => part === 0);
      if (inactiveSlot !== -1) {
        const activeSlot = distribution.findIndex((part) => part > 0);
        [distribution[activeSlot], distribution[inactiveSlot]] = [0, distribution[activeSlot]];
      } else {
        const donor = distribution.findIndex((part) => part > 1);
        if (donor !== -1) distribution[(donor + 1) % 4] += 1, distribution[donor] -= 1;
      }
    }
    lastAwakeDistribution = distribution;
    return distribution;
  }

  function constructIntervals(input) {
    const awake = distributeAwake(input.awakeMinutes, input.wakeCount);
    const sequence = [
      { stage: 'Awake', duration: awake[0] }, { stage: 'Core', duration: input.stages.Core },
      { stage: 'Awake', duration: awake[1] }, { stage: 'Deep', duration: input.stages.Deep },
      { stage: 'Awake', duration: awake[2] }, { stage: 'REM', duration: input.stages.REM },
      { stage: 'Awake', duration: awake[3] }
    ];
    let elapsed = 0;
    const intervals = [];
    for (const item of sequence) {
      if (item.duration === 0) continue;
      const start = new Date(input.start.getTime() + elapsed * 60000);
      elapsed += item.duration;
      const end = new Date(input.start.getTime() + elapsed * 60000);
      intervals.push({ stage: item.stage, duration: item.duration, start, end });
    }
    if (elapsed !== input.windowMinutes) throw new Error('The generated timeline did not match the sleep window. Please try again.');
    return intervals;
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  }

  function formatDateTime(date) {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  }

  function showResults(input, intervals) {
    intervalList.replaceChildren();
    timeline.replaceChildren();
    for (const interval of intervals) {
      const key = interval.stage.toLowerCase();
      const row = document.createElement('li');
      row.className = `interval-row ${key}`;
      const main = document.createElement('div'); main.className = 'interval-main';
      const dot = document.createElement('span'); dot.className = 'stage-indicator';
      const stage = document.createElement('span'); stage.className = 'interval-stage'; stage.textContent = interval.stage;
      const time = document.createElement('span'); time.className = 'interval-time'; time.textContent = `${formatDateTime(interval.start)} – ${formatDateTime(interval.end)}`;
      const duration = document.createElement('span'); duration.className = 'interval-duration'; duration.textContent = durationLabel(interval.duration);
      main.append(dot, stage, time); row.append(main, duration); intervalList.append(row);

      const segment = document.createElement('span');
      segment.className = `timeline-segment ${key}`;
      segment.style.flex = `${interval.duration} 0 0`;
      segment.title = `${interval.stage}: ${formatTime(interval.start)}–${formatTime(interval.end)} (${durationLabel(interval.duration)})`;
      timeline.append(segment);
    }
    timeline.setAttribute('aria-label', intervals.map((i) => `${i.stage} ${durationLabel(i.duration)}`).join(', '));
    document.querySelector('#timeline-start').textContent = formatDateTime(input.start);
    document.querySelector('#timeline-end').textContent = formatDateTime(input.end);
    results.hidden = false;
    copyStatus.textContent = '';
  }

  function generateTimeline() {
    try {
      const input = readInputs();
      generatedIntervals = constructIntervals(input);
      showResults(input, generatedIntervals);
      message.hidden = true;
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
      results.hidden = true;
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    generateTimeline();
  });
  document.querySelector('#regenerate-button').addEventListener('click', generateTimeline);

  document.querySelector('#copy-button').addEventListener('click', async () => {
    const text = generatedIntervals.map((item) => `${formatTime(item.start)} - ${formatTime(item.end)} | ${item.stage}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      copyStatus.textContent = 'Results copied to clipboard.';
    } catch (_) {
      copyStatus.textContent = 'Clipboard access is unavailable in this browser.';
    }
  });

  document.querySelector('#reset-button').addEventListener('click', () => {
    form.reset();
    results.hidden = true;
    message.hidden = true;
    copyStatus.textContent = '';
    generatedIntervals = [];
    lastAwakeDistribution = null;
  });
})();
