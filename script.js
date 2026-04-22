const algorithmSelect = document.getElementById('algorithm');
const timeQuantumGroup = document.getElementById('time-quantum-group');
const processTbody = document.getElementById('process-tbody');

algorithmSelect.addEventListener('change', toggleTimeQuantum);
toggleTimeQuantum();

function toggleTimeQuantum() {
    timeQuantumGroup.style.display = algorithmSelect.value === 'rr' ? 'block' : 'none';
}

function addProcess() {
    const row = document.createElement('tr');
    const processCount = processTbody.rows.length + 1;

    row.innerHTML = `
        <td><input type="text" value="P${processCount}" class="process-id"></td>
        <td><input type="number" value="0" min="0" class="arrival-time"></td>
        <td><input type="number" value="1" min="1" class="burst-time"></td>
        <td><input type="number" value="1" min="1" class="priority"></td>
        <td><button class="remove-btn" onclick="removeProcess(this)">Remove</button></td>
    `;

    processTbody.appendChild(row);
}

function removeProcess(button) {
    const row = button.closest('tr');
    if (row) {
        row.remove();
    }
}

function getProcesses() {
    return Array.from(processTbody.rows).map((row, index) => ({
        id: row.cells[0].querySelector('.process-id').value.trim() || `P${index + 1}`,
        at: parseInt(row.cells[1].querySelector('.arrival-time').value, 10) || 0,
        bt: parseInt(row.cells[2].querySelector('.burst-time').value, 10) || 0,
        priority: parseInt(row.cells[3].querySelector('.priority').value, 10) || 0,
        ct: 0,
        wt: 0,
        tat: 0,
        order: index
    }));
}

function calculate() {
    const algorithm = algorithmSelect.value;
    const timeQuantum = parseInt(document.getElementById('time-quantum').value, 10) || 2;
    const processes = getProcesses();

    if (processes.length === 0) {
        alert('Please add at least one process.');
        return;
    }

    if (processes.some(process => process.bt <= 0)) {
        alert('Burst time must be at least 1 for every process.');
        return;
    }

    let results;

    switch (algorithm) {
        case 'fcfs':
            results = fcfs(processes);
            break;
        case 'sjf-non':
            results = sjfNonPreemptive(processes);
            break;
        case 'sjf-pre':
            results = sjfPreemptive(processes);
            break;
        case 'rr':
            results = roundRobin(processes, timeQuantum);
            break;
        case 'priority':
            results = priorityNonPreemptive(processes);
            break;
        default:
            alert('Please select a valid algorithm.');
            return;
    }

    updateSelectedAlgorithmLabel(algorithm, timeQuantum);
    renderResults(results);
    document.getElementById('output-section').style.display = 'block';
}

function fcfs(processes) {
    const scheduled = cloneProcesses(processes).sort((a, b) => a.at - b.at || a.order - b.order);
    const gantt = [];
    let currentTime = 0;

    scheduled.forEach(process => {
        if (currentTime < process.at) {
            currentTime = process.at;
        }

        const start = currentTime;
        process.ct = start + process.bt;
        process.tat = process.ct - process.at;
        process.wt = process.tat - process.bt;
        gantt.push({ id: process.id, start, end: process.ct });
        currentTime = process.ct;
    });

    return finalizeResult(scheduled, gantt);
}

function sjfNonPreemptive(processes) {
    const pending = cloneProcesses(processes).sort((a, b) => a.at - b.at || a.order - b.order);
    const readyQueue = [];
    const completed = [];
    const gantt = [];
    let currentTime = 0;

    while (completed.length < processes.length) {
        while (pending.length > 0 && pending[0].at <= currentTime) {
            readyQueue.push(pending.shift());
        }

        if (readyQueue.length === 0) {
            currentTime = pending[0].at;
            continue;
        }

        readyQueue.sort((a, b) => a.bt - b.bt || a.at - b.at || a.order - b.order);
        const process = readyQueue.shift();
        const start = currentTime;

        process.ct = start + process.bt;
        process.tat = process.ct - process.at;
        process.wt = process.tat - process.bt;
        gantt.push({ id: process.id, start, end: process.ct });

        currentTime = process.ct;
        completed.push(process);
    }

    return finalizeResult(completed, gantt);
}

function sjfPreemptive(processes) {
    const remaining = cloneProcesses(processes)
        .sort((a, b) => a.at - b.at || a.order - b.order)
        .map(process => ({ ...process, remainingBt: process.bt }));
    const completed = [];
    const gantt = [];
    let currentTime = 0;
    let activeSegment = null;

    while (completed.length < processes.length) {
        const available = remaining.filter(process => process.at <= currentTime && process.remainingBt > 0);

        if (available.length === 0) {
            const nextArrival = Math.min(...remaining.filter(process => process.remainingBt > 0).map(process => process.at));
            currentTime = nextArrival;
            activeSegment = null;
            continue;
        }

        available.sort((a, b) => a.remainingBt - b.remainingBt || a.at - b.at || a.order - b.order);
        const current = available[0];

        if (!activeSegment || activeSegment.id !== current.id) {
            activeSegment = { id: current.id, start: currentTime, end: currentTime + 1 };
            gantt.push(activeSegment);
        } else {
            activeSegment.end = currentTime + 1;
        }

        current.remainingBt -= 1;
        currentTime += 1;

        if (current.remainingBt === 0) {
            current.ct = currentTime;
            current.tat = current.ct - current.at;
            current.wt = current.tat - current.bt;
            completed.push(current);
        }
    }

    return finalizeResult(completed, gantt);
}

function priorityNonPreemptive(processes) {
    const pending = cloneProcesses(processes).sort((a, b) => a.at - b.at || a.order - b.order);
    const readyQueue = [];
    const completed = [];
    const gantt = [];
    let currentTime = 0;

    while (completed.length < processes.length) {
        while (pending.length > 0 && pending[0].at <= currentTime) {
            readyQueue.push(pending.shift());
        }

        if (readyQueue.length === 0) {
            currentTime = pending[0].at;
            continue;
        }

        readyQueue.sort((a, b) => a.priority - b.priority || a.at - b.at || a.order - b.order);
        const process = readyQueue.shift();
        const start = currentTime;

        process.ct = start + process.bt;
        process.tat = process.ct - process.at;
        process.wt = process.tat - process.bt;
        gantt.push({ id: process.id, start, end: process.ct });

        currentTime = process.ct;
        completed.push(process);
    }

    return finalizeResult(completed, gantt);
}

function roundRobin(processes, timeQuantum) {
    const pending = cloneProcesses(processes)
        .sort((a, b) => a.at - b.at || a.order - b.order)
        .map(process => ({ ...process, remainingBt: process.bt }));
    const readyQueue = [];
    const completed = [];
    const gantt = [];
    let currentTime = 0;

    while (completed.length < processes.length) {
        while (pending.length > 0 && pending[0].at <= currentTime) {
            readyQueue.push(pending.shift());
        }

        if (readyQueue.length === 0) {
            currentTime = pending[0].at;
            continue;
        }

        const process = readyQueue.shift();
        const start = currentTime;
        const executionTime = Math.min(timeQuantum, process.remainingBt);

        process.remainingBt -= executionTime;
        currentTime += executionTime;
        gantt.push({ id: process.id, start, end: currentTime });

        while (pending.length > 0 && pending[0].at <= currentTime) {
            readyQueue.push(pending.shift());
        }

        if (process.remainingBt > 0) {
            readyQueue.push(process);
        } else {
            process.ct = currentTime;
            process.tat = process.ct - process.at;
            process.wt = process.tat - process.bt;
            completed.push(process);
        }
    }

    return finalizeResult(completed, gantt);
}

function renderResults({ processes, gantt }) {
    const tbody = document.getElementById('result-tbody');
    tbody.innerHTML = '';

    let totalWt = 0;
    let totalTat = 0;
    const colors = new Map();

    processes.forEach(process => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="pid-badge" style="background-color: ${getProcessColor(process.id, colors)};">${process.id.replace(/^P/i, '')}</span></td>
            <td>${process.at}</td>
            <td>${process.bt}</td>
            <td>${process.wt}</td>
            <td>${process.tat}</td>
        `;

        tbody.appendChild(row);
        totalWt += process.wt;
        totalTat += process.tat;
    });

    const avgWt = (totalWt / processes.length).toFixed(2);
    const avgTat = (totalTat / processes.length).toFixed(2);
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.innerHTML = `
        <td>Total</td>
        <td></td>
        <td></td>
        <td>${totalWt}</td>
        <td>${totalTat}</td>
    `;
    tbody.appendChild(totalRow);

    document.getElementById('avg-wt-value').textContent = avgWt;
    document.getElementById('avg-tat-value').textContent = avgTat;
    
    renderGanttChart(gantt);
}

function updateSelectedAlgorithmLabel(algorithm, timeQuantum) {
    const labels = {
        fcfs: 'First Come First Serve (FCFS)',
        rr: `Round Robin (RR), Time Quantum = ${timeQuantum}`,
        'sjf-non': 'Shortest Job First (SJF)',
        'sjf-pre': 'Shortest Remaining Time First (SRTF)',
        priority: 'Priority Scheduling'
    };

    document.getElementById('selected-algorithm').textContent = `Current Algorithm: ${labels[algorithm] || algorithm}`;
}

function renderGanttChart(gantt) {
    const container = document.getElementById('gantt-container');
    const axis = document.getElementById('time-axis');

    container.innerHTML = '';
    axis.innerHTML = '';

    if (gantt.length === 0) {
        return;
    }

    const maxTime = Math.max(...gantt.map(segment => segment.end));
    const scale = maxTime > 0 ? 500 / maxTime : 0;
    const colors = new Map();
    const segmentWidths = [];
    let axisWidth = 0;

    gantt.forEach(segment => {
        const segmentWidth = Math.max((segment.end - segment.start) * scale, 30);
        segmentWidths.push(segmentWidth);
        axisWidth += segmentWidth;

        const bar = document.createElement('div');
        bar.className = 'gantt-bar';
        bar.style.width = `${segmentWidth}px`;
        bar.style.backgroundColor = getProcessColor(segment.id, colors);
        bar.textContent = segment.id;
        container.appendChild(bar);
    });

    axis.style.width = `${axisWidth}px`;

    let currentPosition = 0;
    const startTick = document.createElement('span');
    startTick.textContent = `${gantt[0].start}`;
    startTick.style.left = '0px';
    startTick.style.transform = 'translateX(0)';
    axis.appendChild(startTick);

    gantt.forEach((segment, index) => {
        currentPosition += segmentWidths[index];
        const tick = document.createElement('span');
        tick.textContent = `${segment.end}`;
        tick.style.left = `${currentPosition}px`;

        if (index === gantt.length - 1) {
            tick.style.transform = 'translateX(-100%)';
        }

        axis.appendChild(tick);
    });
}

function cloneProcesses(processes) {
    return processes.map(process => ({ ...process }));
}

function finalizeResult(processes, gantt) {
    return {
        processes: processes
            .sort((a, b) => a.order - b.order)
            .map(({ order, remainingBt, ...process }) => process),
        gantt
    };
}

function getProcessColor(processId, colorMap) {
    if (!colorMap.has(processId)) {
        colorMap.set(processId, getRandomColor(colorMap.size));
    }

    return colorMap.get(processId);
}

function getRandomColor(index) {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    return colors[index % colors.length];
}
