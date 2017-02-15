const micro = require( 'micro' );
const { always, concat, join, map, pipe, range, take } = require( 'ramda' );
const { reject, shuffle } = require( 'lodash' );

const {
	channelName,
	cribbsPerWeek,
	oneOnOnesPerWeek,
	teamMembers,
} = require( './config' );

const weekdays = [
	'Monday',
	'Tuesday',
	'Thursday',
	'Friday',
];

const getRandomMeetingsForTheWeek = () => {
	let oneOnOnes = {};

	do {
		oneOnOnes = {};
		teamMembers.map( ( name ) => {
			oneOnOnes[ name ] = [];
		} );

		shuffle( teamMembers ).map( ( name ) => {
			const possibleMeetings = shuffle( reject( teamMembers, ( member ) => (name === member) ) );

			possibleMeetings.map( ( member ) => {
				if (
					Math.max( // check if either team member has had enough meetings for the week.
						oneOnOnes[ name ].length,
						oneOnOnes[ member ].length
					) >= oneOnOnesPerWeek
					|| oneOnOnes[ name ].indexOf( member ) !== - 1 // crosscheck if member and name already have a meeting
					|| oneOnOnes[ member ].indexOf( name ) !== - 1
				) {
					return;
				}

				oneOnOnes[ name ] = [ ...oneOnOnes[ name ], member ];
				oneOnOnes[ member ] = [ ...oneOnOnes[ member ], name ];
			} );

		} );

		/**
		 * Because of the algorithm randomness sometimes some people don't have enough meetings throughout the week.
		 * This loop makes sure everyone has enough meetings for the week.
		 */
	} while ( reject( oneOnOnes, ( meetings ) => (
		meetings.length < oneOnOnesPerWeek
	) ).length != teamMembers.length );

	return oneOnOnes;
};

const convertMeetingsToText = ( meetings ) => (
	teamMembers.map( ( member ) => (
		`${member} is meeting with: ${meetings[ member ].join( ', ' )}`
	) )
);

const meetingsText = [ 'Meetings for the week!\n', ...convertMeetingsToText( getRandomMeetingsForTheWeek() ) , '\n' ];

const timeslots = range( 11, 19 ).map( hh => `${hh}:00` );

const draw = pipe( shuffle, take( 1 ) );

const reminders = pipe(
	always( weekdays ),
	shuffle,
	take( cribbsPerWeek ),
	map( day => `/remind ${channelName} Cribbs-Fonseca pairing! ${teamMembers.join()} at ${draw(timeslots)} on ${day}` ),
	concat( meetingsText ),
	join( '\n' )
);

const server = micro( async (req, res) => {
	res.writeHead( 200 )
	res.end( reminders() )
} );

server.listen( 3000 );
