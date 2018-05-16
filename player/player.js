var stepped = 0,
	chunks = 0,
	rows = 0;
var start, end;
var parser;
var pauseChecked = false;
var printStepChecked = false;

$(function () {
	$('#submit-parse').click(function () {
		stepped = 0;
		chunks = 0;
		rows = 0;

		var txt = $('#input').val();
		var localChunkSize = $('#localChunkSize').val();
		var remoteChunkSize = $('#remoteChunkSize').val();
		var files = $('#files')[0].files;
		var config = buildConfig();

		// NOTE: Chunk size does not get reset if changed and then set back to empty/default value
		if (localChunkSize)
			Papa.LocalChunkSize = localChunkSize;
		if (remoteChunkSize)
			Papa.RemoteChunkSize = remoteChunkSize;

		pauseChecked = $('#step-pause').prop('checked');
		printStepChecked = $('#print-steps').prop('checked');


		if (files.length > 0) {
			if (!$('#stream').prop('checked') && !$('#chunk').prop('checked')) {
				for (var i = 0; i < files.length; i++) {
					if (files[i].size > 1024 * 1024 * 10) {
						alert("A file you've selected is larger than 10 MB; please choose to stream or chunk the input to prevent the browser from crashing.");
						return;
					}
				}
			}

			start = performance.now();

			$('#files').parse({
				config: config,
				before: function (file, inputElem) {
					console.log("Parsing file:", file);
				},
				complete: function () {
					console.log("Done with all files.");
				}
			});
		} else {
			start = performance.now();
			var results = Papa.parse(txt, config);
			console.log("Synchronous parse results:", results);
		}
	});

	$('#submit-unparse').click(function () {
		var input = $('#input').val();
		var delim = $('#delimiter').val();
		var header = $('#header').prop('checked');

		var results = Papa.unparse(input, {
			delimiter: delim,
			header: header,
		});

		console.log("Unparse complete!");
		console.log("--------------------------------------");
		console.log(results);
		console.log("--------------------------------------");
	});

	$('#insert-tab').click(function () {
		$('#delimiter').val('\t');
	});
});



function buildConfig() {
	return {
		delimiter: $('#delimiter').val(),
		newline: getLineEnding(),
		header: $('#header').prop('checked'),
		dynamicTyping: $('#dynamicTyping').prop('checked'),
		preview: parseInt($('#preview').val() || 0),
		step: $('#stream').prop('checked') ? stepFn : undefined,
		encoding: $('#encoding').val(),
		worker: $('#worker').prop('checked'),
		comments: $('#comments').val(),
		complete: completeFn,
		error: errorFn,
		download: $('#download').prop('checked'),
		fastMode: $('#fastmode').prop('checked'),
		skipEmptyLines: $('#skipEmptyLines').prop('checked'),
		chunk: $('#chunk').prop('checked') ? chunkFn : undefined,
		beforeFirstChunk: undefined,
	};

	function getLineEnding() {
		if ($('#newline-n').is(':checked'))
			return "\n";
		else if ($('#newline-r').is(':checked'))
			return "\r";
		else if ($('#newline-rn').is(':checked'))
			return "\r\n";
		else
			return "";
	}
}

function stepFn(results, parserHandle) {
	stepped++;
	rows += results.data.length;

	parser = parserHandle;

	if (pauseChecked) {
		console.log(results, results.data[0]);
		parserHandle.pause();
		return;
	}

	if (printStepChecked)
		console.log(results, results.data[0]);
}

function chunkFn(results, streamer, file) {
	if (!results)
		return;
	chunks++;
	rows += results.data.length;

	parser = streamer;

	if (printStepChecked)
		console.log("Chunk data:", results.data.length, results);

	if (pauseChecked) {
		console.log("Pausing; " + results.data.length + " rows in chunk; file:", file);
		streamer.pause();
		return;
	}
}

function errorFn(error, file) {
	console.log("ERROR:", error, file);
}

function unwrapString(value) {
	if (value.length < 2 || value.charAt(0) !== '\'' || value.substr(-1) !== '\'')
		return value;
	var result = value.substring(1, value.length - 1);

	// if value use "''" as to escape "'"
	// if ((result.match(/\'/g) || []).length !== (result.match(/\'\'/g) || []).length * 2) // only "''", no single "'"
	// 	return value;
	// result = result.replace(/\'\'/g, '\'')

	return result;
}

function expandMultiValue(multiValue, func) {
	if (!_.isString(multiValue))
		return 0;

	if (multiValue.length < 2 || multiValue.charAt(0) !== '\'' || multiValue.substr(-1) !== '\'')
		return 0;

	var values = [];
	var inString = 0;
	for (var i = 1; i < multiValue.length; i++) {
		if (multiValue.charAt(i) === '\'') {
			if (i + 2 < multiValue.length) {
				if (multiValue.charAt(i + 1) === '\t' && multiValue.charAt(i + 2) === '\'') { // not last value
					values.push(multiValue.substring(inString, i + 1));
					i = i + 2;
					inString = i;
				} else if (multiValue.charAt(i + 1) === '\'') { // if use "''" to escape "'"
					// ++i; // if use "''" to escape "'"
				} else {
					// do nothing
					// return 0; // if use "''" to escape "'"
				}
			} else if (i + 1 === multiValue.length) { // last value
				values.push(multiValue.substring(inString, i + 1));
				inString = multiValue.length;
			} else {
				return 0;
			}
		}
	}
	if (inString !== multiValue.length)
		return 0;

	_.each(values, function (value) {
		func(value);
	});

	return values.length;
}

function completeFn() {
	end = performance.now();
	if (!$('#stream').prop('checked') &&
		!$('#chunk').prop('checked') &&
		arguments[0] &&
		arguments[0].data) {

		rows = arguments[0].data.length;

		var mode = 'MateCat'; // 'MateCat'
		/* original data */
		var filename = (arguments[1] && arguments[1].name) ? String(arguments[1].name) : 'output';

		if (filename.toLowerCase().endsWith('.csv'))
			filename = filename.substring(0, filename.length - 4);
		filename += '.xlsx';
		var data = arguments[0].data;
		var outputData = [];

		if (data[0] && data[0][0] && data[0][0] === 'Entity') { // output from RadLex
			var entityCol = 0;
			var acronymCol = _.indexOf(data[0], 'Acronym');
			var commentCol = _.indexOf(data[0], 'Comment');
			var definitionCol = _.indexOf(data[0], 'Definition');
			var preferredEnCol = _.indexOf(data[0], 'Preferred_name');
			var preferredDeCol = _.indexOf(data[0], 'Preferred_name_German');
			var synonymEnCol = _.indexOf(data[0], 'Synonym');
			var synonymDeCol = _.indexOf(data[0], 'Synonym_German');

			if (preferredEnCol > -1 && preferredDeCol > -1 && synonymEnCol > -1 && synonymDeCol > -1) { // valid RadLex
				_.each(data, function (rowData, row) { // each row
					if (row === 0)
						outputData.push(rowData);
					else { // not header row
						_.each(rowData, function (cellData, col) { // each col
							if (col === commentCol || col === definitionCol || col === preferredEnCol || col === preferredDeCol)
								rowData[col] = unwrapString(rowData[col]);
						});

						var outputRowData;

						if (mode === 'MateCat') {
							_.each(rowData, function (cellData, col) { // each col
								switch (col) {
									case preferredEnCol:
										outputRowData = _.clone(rowData);
										outputRowData[synonymEnCol] = rowData[preferredEnCol];
										outputRowData[synonymDeCol] = rowData[preferredDeCol];
										outputData.push(outputRowData);
										break;
									case preferredDeCol:
										// do nothing, see above
										break;
									case synonymEnCol:
										expandMultiValue(cellData, value => {
											outputRowData = _.clone(rowData);
											outputRowData[synonymEnCol] = unwrapString(value);
											outputRowData[synonymDeCol] = rowData[preferredDeCol];
											outputData.push(outputRowData);
										});
										break;
									case synonymDeCol:
										expandMultiValue(cellData, value => {
											outputRowData = _.clone(rowData);
											outputRowData[synonymEnCol] = rowData[preferredEnCol];
											outputRowData[synonymDeCol] = unwrapString(value);
											outputData.push(outputRowData);
										});
										break;
									case acronymCol:
										if (cellData !== '') {
											expandMultiValue(cellData, value => {
												outputRowData = _.clone(rowData);
												outputRowData[synonymEnCol] = unwrapString(value);
												outputRowData[synonymDeCol] = unwrapString(value);
												outputData.push(outputRowData);
											});
										}
										break;
									default:
										// do nothing
								}
							});
						} else if (mode === 'SmartCat') {

						}
					}
				});
			} else
				outputData = data;
		} else
			outputData = data;

		var wsName = "Data";

		if (typeof console !== 'undefined') console.log(new Date());
		var wb = XLSX.utils.book_new(),
			ws = XLSX.utils.aoa_to_sheet(outputData);

		/* add worksheet to workbook */
		XLSX.utils.book_append_sheet(wb, ws, wsName);

		/* write workbook */
		if (typeof console !== 'undefined') console.log(new Date());
		XLSX.writeFile(wb, filename);
		if (typeof console !== 'undefined') console.log(new Date());
	}
	console.log("Finished input (async). Time:", end - start, arguments);
	console.log("Rows:", rows, "Stepped:", stepped, "Chunks:", chunks);
}