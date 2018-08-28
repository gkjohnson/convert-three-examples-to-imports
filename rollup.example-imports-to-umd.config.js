const path = require( 'path' );
const fs = require( 'fs' );

// Creates an rollup config object for the given file to
// be output to umd format
function createOutput( file ) {

	const inputPath = path.resolve( file );
	const outputPath = inputPath.replace( /\.module\.js$/, '.js' );

	// Every import is marked as external so the output is 1-to-1. We
	// assume that that global object should be the THREE object so we
	// replicate the existing behavior.
	return {

		input: inputPath,
		treeshake: false,
		external: p => p !== inputPath,

		output: {

			format: 'umd',
			name: 'THREE',
			file: outputPath,

			globals: () => 'THREE',
			extend: true

		}

	};

}

// Walk the file structure starting at the given directory and fire
// the callback for every file.
function walk( dir, cb ) {

	const files = fs.readdirSync( dir );
	files.forEach( f => {

		const p = path.join( dir, f );
		const stats = fs.statSync( p );
		if ( stats.isDirectory() ) {

			walk( p, cb );

		} else {

			cb( p );

		}

	} );

}

// Gather up all the files
const files = [];
walk( './examples/', p => files.push( p ) );

// Create a rollup config for each module.js file
const rollupConfigs = files
	.filter( p => /\.module\.js$/.test( p ) )
	.map( p => createOutput( p ) );

export default rollupConfigs;
