const fs = require( 'fs' );
const path = require( 'path' );

const OVERWRITE_FILES = false;
const REMOVE_OLD_FILES = true;

// Get the absolute path to the built THREE.js module
const moduleThreePath = path.join( __dirname, 'build/three.module.js' );
const ignoreExports = [
	'Float32BufferAttribute'
];

const ignoreFiles = [
	/js\/renderers\/RaytracingWorker\.js$/,
	/js\/nodes\//,
	/js\/loaders\/sea3d\//,
	/\/XLoader\.js$/,
	/js\/libs\//,
	/js\/loaders\/NodeMaterialLoader\.js$/
];

const exportsNothing = [
	/RectAreaLightUniformsLib\.js/
];

function mangleName( name ) {

	return `__${ name }`;

}

function removeComments( str ) {

	return str
		// .replace( /`[^`]*?`/g, '' )
		// .replace( /'[^']*?'/g, '' )
		// .replace( /"[^"]*?"/g, '' )
		.replace( /\/\*[\s\S]*?\*\//g, '' )
		.replace( /\/\/[\s\S]*?\n/g, '' );

}

// Walk down the directory structure
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

function transformName( dir ) {

	if ( OVERWRITE_FILES ) {

		return dir;

	} else {

		return dir
			.replace( /\.js$/, '.module.js' )
			.replace( /\.html$/, '.module.html' );

	}

}

function isIgnored( p ) {

	return ignoreFiles.filter( re => re.test( p.replace( /\\/g, '/' ) ) ).length !== 0;

}

function doesExportNothing( p ) {

	return exportsNothing.filter( re => re.test( p.replace( /\\/g, '/' ) ) ).length !== 0;

}

// exported names to the paths that export them and vice versa
const name2path = {};
const path2names = {};

// duplicate names
const dupedNames = [];

// Traverse javascript files and find what values were exported
// onto the THREE object
walk( path.join( __dirname, 'examples' ), path2 => {

	if ( /\.module\.js$/.test( path2 ) ) return;

	if ( /\.js$/.test( path2 ) ) {

		if ( isIgnored( path2 ) ) {

			return;

		}


		// file contents
		const contents = fs.readFileSync( path2, { encoding: 'utf8' } );
		const trimmedContents = removeComments( contents );

		// regex for finding objects that were added to THREE
		const regex = /THREE.([^.\s]+)\s*=[^=]/g;
		const names = {};
		while ( true ) {

			// exit if we don't find anything more
			const match = regex.exec( trimmedContents );
			if ( ! match ) break;

			// grab the item directly on THREE that was changed
			let name = match[ 1 ];
			if ( name.indexOf( '.' ) !== - 1 ) name = name.split( '.' )[ 0 ];


			// Check for dupes and save it
			if ( name in name2path && name2path[ name ] !== path2 ) {

				console.error( `"${ name }" is defined by two files : ` );
				console.error( `\t${ path2 }` );
				console.error( `\t${ name2path[ name ] }` );
				console.error( '' );
				dupedNames.push( name );

			}

			if ( ! names[ name ] && ! ignoreExports.includes( name ) ) {

				name2path[ name ] = path2;
				path2names[ path2 ] = path2names[ path2 ] || [];
				path2names[ path2 ].push( name );

			}

			names[ name ] = true;

		}

		// Don't do anything if the file wasn't exporting data
		if ( Object.keys( names ).length === 0 && ! doesExportNothing( path2 ) ) {

			delete path2names[ path2 ];
			return;

		} else {

			path2names[ path2 ] = path2names[ path2 ] || [];

		}

		// Replace all exported THREE references with local ones
		let newContents = contents;
		Object.keys( names )
			.forEach( n => {

				const re = new RegExp( `THREE\.${ n }([^A-Za-z0-9_$])`, 'g' );
				newContents = newContents.replace( re, ( orig, next ) => `${ mangleName( n ) }${ next }` );

			} );

		// Define the new local reference at the top of the file
		let exportInfo =
			Object.keys( names )
				.map( n => `var ${ mangleName( n ) };` )
				.join( '\n' );

		// Add those references below the author comment
		if ( newContents.trim().indexOf( '/*' ) === 0 ) {

			newContents =
				newContents
					.replace( /\/\*[\s\S]*?\*\//, data => `${ data }\n${ exportInfo }` );


		} else {

			newContents = exportInfo + newContents;

		}

		// Export the new item
		newContents =
			newContents
			+ `\nexport { ${ Object.keys( names ).map( n => `${ mangleName( n ) } as ${ n }` ).join( ', ' ) } };\n`;

		if ( REMOVE_OLD_FILES ) fs.unlinkSync( path2 );
		fs.writeFileSync( transformName( path2 ), newContents, { encoding: 'utf8' } );

	}

} );

// Import the newly exported objects into other files
walk( path.join( __dirname, 'examples' ), path2 => {

	if ( ! OVERWRITE_FILES && ! /\.module\.js$/.test( path2 ) ) return;

	if ( isIgnored( path2 ) ) {

		return;

	}

	if ( /\.js$/.test( path2 ) ) {

		// file contents and the modified version
		const contents = fs.readFileSync( path2, { encoding: 'utf8' } );
		const trimmedContents = removeComments( contents );
		let newContents = contents;

		// track all of the paths that are implicitly referenced by accessing data on the THREE object
		const referencedPaths = {};
		Object
			.entries( name2path )
			.forEach( ( [ name, p ] ) => {

				// Find all exports that are referenced
				const re = new RegExp( `THREE\\.${ name }([^A-Za-z0-9_$])`, 'g' );
				if ( re.test( trimmedContents ) ) {

					newContents = newContents.replace( re, ( orig, next ) => `${ name }${ next }` );

					referencedPaths[ p ] = referencedPaths[ p ] || [];
					referencedPaths[ p ].push( name );

					if ( dupedNames.includes( name ) ) {

						console.error( `Duped export "${ name }" referenced in : `, path2 );

					}

				}

			} );

		// Early out if there are no references to exported objects or to THREE
		if ( ! /THREE\./g.test( trimmedContents ) && Object.keys( referencedPaths ).length === 0 ) return;

		// Form the import statements for three and the other imported files
		const directory = path.dirname( path2 );
		const importInfo =
			(
				/THREE\./g.test( trimmedContents ) ?
					`import * as THREE from '${ path.relative( directory, moduleThreePath ).replace( /\\/g, '/' ) }';\n` :
					''
			)
			+ Object
				.entries( referencedPaths )
				.map( ( [ p, names ] ) => {

					let relpath = path.relative( directory, p );
					if ( relpath[ 0 ] !== '.' ) relpath = `./${ relpath }`;
					relpath = relpath.replace( /\\/g, '/' );

					const filteredNames = names.filter( n => new RegExp( `THREE\\.${ n }` ).test( trimmedContents ) );

					if ( filteredNames.length === 0 ) return null;
					else return `import { ${ filteredNames.join( ', ' ) } } from '${ transformName( relpath ) }';`;

				} )
				.filter( s => ! ! s )
				.join( '\n' );

		// Add the imports after the author comment
		if ( newContents.trim().indexOf( '/*' ) === 0 ) {

			newContents =
				newContents
					.replace( /\/\*[\s\S]*?\*\//, data => `${ data }\n${ importInfo }` );

		} else {

			newContents = importInfo + newContents;

		}

		fs.writeFileSync( path2, newContents, { encoding: 'utf8' } );

	}

} );

walk( path.join( __dirname, 'examples' ), path2 => {

	if ( /\.module\.html/.test( path2 ) ) return;

	if ( isIgnored( path2 ) ) {

		return;

	}

	if ( /\.html$/.test( path2 ) ) {

		// file contents and the modified version
		const contents = fs.readFileSync( path2, { encoding: 'utf8' } );
		let newContents = contents;

		// the directory this file is in
		const directory = path.dirname( path2 );

		// all script tags that import example files
		const matches = contents.match( /<script.*?src\s*=\s*["'].*?["'].*?>/g );
		let scriptImports = [];

		if ( matches ) {

			// remove the script imports that were changed to es6 imports
			const extracted =
				matches
					.map( s => s.match( /<script.*?src=["'](.*?)["'].*?>/ )[ 1 ] );

			const threeTags =
				extracted
					.filter( s => /((three\.min\.js)|(three\.js))$/.test( s ) );

			const filtered =
				extracted
					.filter( s => {

						s = `./${ s }`;
						s = path.join( directory, s );
						return s in path2names;

					} );

			// convert the extracted tags to absolute paths
			scriptImports =
				filtered
					.map( s => `./${ s }` )
					.map( p => path.join( directory, p ) );

			// remove the script tags
			[
				...filtered,
				...threeTags
			].forEach( e => {

				newContents = newContents.replace( new RegExp( `<script.*?src\s*=\s*["']${ e }["'].*?>.*?</script>`, 'g' ), '' );

			} );

		}

		// If nothing is imported then do nothing
		// if ( OVERWRITE_FILES && scriptImports === null || scriptImports.length === 0 ) return;

		// replace the script tag body contents in the html
		newContents =
			newContents.replace( /(<script.*?>)([\s\S]*?)<\/script\s*?>/g, ( orig, tag, body ) => {

				// if this is a remaining script with src tag then skip it
				if ( /<script.*?src\s*=/.test( tag ) ) return orig;

				const scriptTypeMatch = tag.match( /<script.*?type\s*=\s*["'](.*?)["']/ );
				if ( scriptTypeMatch && scriptTypeMatch[ 1 ] !== 'type/javascript' ) return orig;

				// replace the exported references on THREE with the raw names
				const trimmedBody = removeComments( body );

				// get indentation for the new statements
				const tabsMatch = body.match( /\t+/ );
				const tabs = tabsMatch ? tabsMatch[ 0 ] : '\t\t';

				if ( ! tabsMatch ) console.error( `couldn't find tabs for file ${ path2 }` );

				// Find the relevant imports for this code block
				const filteredImports =
					scriptImports
						.map( si => {

							let relpath = path.relative( directory, si );
							if ( relpath[ 0 ] !== '.' ) relpath = `./${ relpath }`;
							relpath = relpath.replace( /\\/g, '/' );

							const origNames = path2names[ si ];
							const names =
								origNames
									.filter( n => new RegExp( `THREE\\.${ n }` ).test( trimmedBody ) );

							if ( origNames.length === 0 ) {

								return `${ tabs }import '${ transformName( relpath ) }';\n`;

							} else if ( names.length === 0 ) {

								return null;

							} else {

								return `${ tabs }import { ${ names.join( ', ' ) } } from '${ transformName( relpath ) }';\n`;

							}



						} )
						.filter( i => ! ! i );

				// TODO: Checking if THREE is defined means it gets added no matter what, which means that some
				// examples that would function without imports don't work. This is related to the `rawimports` list,
				// as well. It's possible that that should be derived from a whitelist.
				if ( filteredImports.length === 0 && ! /THREE\./.test( trimmedBody ) ) return orig;


				let newBody = body;
				scriptImports.forEach( si => {

					if ( si in path2names ) {

						path2names[ si ]
							.forEach( n => newBody = newBody.replace( new RegExp( `THREE\\.${ n }([^A-Za-z0-9_$])`, 'g' ), ( orig, next ) => `${ n }${ next }` ) );

					}

				} );

				newBody = newBody.replace( /Detector/g, 'window.Detector' );
				newBody = newBody.replace( /Stats/g, 'window.Stats' );
				newBody = newBody.replace( /dat\.GUI/g, 'window.dat.GUI' );

				newBody =

					// Add a THREE import
					`\n${ tabs }import * as THREE from '${ path.relative( directory, moduleThreePath ).replace( /\\/g, '/' ) }';\n`

					// Add the imports
					+ filteredImports.join( '' )

					+ newBody;

				return `<script type="module">${ newBody }</script>`;

			} );

		fs.writeFileSync( transformName( path2 ), newContents, { encoding: 'utf8' } );

	}

} );
