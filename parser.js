const fs = require('fs');
const util = require('util');
const minimist = require('minimist');

// Promisify core API's
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

const arguments = minimist(process.argv.slice(2))['_'];

// If the command is parse but no file has been provided
if (arguments.length === 0 || (arguments[0] === 'parse' && arguments.length <= 1)) {
    console.error('You didn\'t provide all the required parameters.\r\n');
}

// Display the help message
if (arguments.length === 0 || (arguments[0] === 'parse' && arguments.length <= 1) || arguments[0] === 'help') {
    console.log(`A simple Kindle notes parser to Markdown.

Usage: parser.js <command> <clipping path>
    
Commands:
    help  Show the help message
    parse Perform the file parsing
`);
    return;
}

const filePath = arguments[arguments.length - 1];
const fileFolder = filePath.slice(0, filePath.lastIndexOf('/'));

const parseNotes = (fileContent) => {
    let remainingFileContent = fileContent;
    let notes = [];
    let parsedNotes = {};

    // Parse the file to split the notes in single instances
    do {
        const separatorPosition = remainingFileContent.indexOf('==========');
        notes.push(remainingFileContent.substr(0, separatorPosition));
        remainingFileContent = remainingFileContent.substr(separatorPosition + 12);
    } while (remainingFileContent !== '');

    // Parse the single notes to identify the properties
    notes.forEach(note => {
        let remainingNote = note;
        let noteChunks = [];

        do {
            const separatorPosition = remainingNote.indexOf('\r\n');
            noteChunks.push(remainingNote.substr(0, separatorPosition));
            remainingNote = remainingNote.substr(separatorPosition + 2);
        } while (remainingNote !== '');

        const titleAndAuthor = noteChunks[0];
        const author = titleAndAuthor.slice(titleAndAuthor.lastIndexOf('(') + 1, titleAndAuthor.length - 1);
        const title = titleAndAuthor.slice(0, titleAndAuthor.lastIndexOf('(') - 1);

        const extraInfo = noteChunks[1].substr(3);
        const position = /(\d+-?(\d+)) \|/.exec(extraInfo)[1];
        const date = extraInfo.substr(extraInfo.indexOf('|') + 2);

        const noteText = noteChunks[3];

        if (parsedNotes[title + author] === undefined) {
            parsedNotes[title + author] = [];
        }

        parsedNotes[title + author].push({
            title,
            author,
            position,
            date,
            noteText
        });
    });

    return parsedNotes;
}

const writeBookNotes = (bookNotes) => {
    let fileContent = '';

    // For each note create a section inside the book file
    bookNotes.forEach(note => {
        if (note.noteText === '') {
            return;
        }

        fileContent += '### ' + note.date + ' (Location ' + note.position + ')\r\n';
        fileContent += note.noteText + '\r\n\r\n';
    })

    // If empty avoid writing the file
    if (fileContent === '') {
        return;
    }

    fileContent = '# ' + bookNotes[0].title + ' - ' + bookNotes[0].author + '\r\n' + fileContent;

    writeFile(fileFolder + '/Kindle Notes Export/' + bookNotes[0].title + ' - ' + bookNotes[0].author + '.md', fileContent);
}

return readFile(filePath, 'utf8').then(mainFileData => {
    // Parse notes and show warning if file is empty or no notes are inside
    let notes = parseNotes(mainFileData);
    if (!Object.keys(notes).length) {
        console.warn('Notes file empty. Exiting...')
        return;
    }

    // Create an export folder
    // @TODO Dynamic
    if (!fs.existsSync(fileFolder + '/Kindle Notes Export')){
        fs.mkdirSync(fileFolder + '/Kindle Notes Export');
    }

    Object.values(notes).forEach(note => {
        writeBookNotes(note);
    })
});
