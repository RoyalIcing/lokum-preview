import React from 'react'
import Axios from 'axios'
import { routesForTrelloData, promiseEnhancedTrelloCards } from 'lokum/lib/trello'

const headerHeight = '2rem'

const headerStyle = {
	position: 'fixed',
	top: 0,
	left: 0,
	right: 0,
	height: headerHeight
}

const iframeHolderStyle = {
	position: 'absolute',
	top: headerHeight,
	left: 0,
	right: 0,
	bottom: 0
}

const iframeStyle = {
	display: 'block',
	width: '100%',
	height: '100%',
	border: 'none'
}

const errorStyle = {
	color: 'red'
}

function renderPreviewHTMLToIFrame(html, iframe) {
	const { contentDocument } = iframe
	contentDocument.open()
	contentDocument.write(html)
	contentDocument.write(`
<script>
function hijackAClick(e) {
	const target = e.currentTarget;
	if (target && target.pathname && target.host === location.host && target.pathname[0] === '/' && target.pathname[1] !== '/') {
		parent.navigatePreviewToPath(target.pathname);
		event.preventDefault();
		event.stopPropagation();
	}
} 

var links = document.getElementsByTagName('a');
for (var i = 0; i < links.length; i++) {
	links[i].addEventListener('click', hijackAClick)
}
</script>
`)
	contentDocument.close()
}

function navigatedTo({ boardID, path = '' }) {
	const hash = `#${ boardID }${ path }`
	window.location.hash = hash
}

function conformPath(path) {
	if (path === '/' || path[path.length - 1] === '/') {
		return path
	}
	else {
		return path + '/'
	}
}

export default class App extends React.Component {
	constructor(props) {
		super(props)

		this.state = {
			initialBoardID: null,
			initialPath: '/'
		}

		this.onChangeBoardID = this.onChangeBoardID.bind(this)
		this.onSetIFrame = this.onSetIFrame.bind(this)
	}

	componentWillMount() {
		if (window) {
			const hashInput = window.location.hash.substring(1)
			const [ potentialBoardID, ...pathComponents ] = hashInput.split('/')
			const path = '/' + (pathComponents.join('/') || '')

			if (this.checkBoardIDAndLoad(potentialBoardID)) {
				this.setState({
					initialBoardID: potentialBoardID,
					initialPath: path
				})
			}
		}
	}

	componentDidMount() {
		window.navigatePreviewToPath = this.navigatePreview.bind(this)
	}

	componentWillUnmount() {
		delete window.navigatePreviewToPath
	}

	loadBoard(boardID) {
		Axios.get(`https://trello.com/b/${ boardID }.json`)
		.then(response => {
			const routes = routesForTrelloData(response.data)
			//navigatedTo({ boardID })
			this.setState({
				boardID,
				boardError: null,
				routes
			}, () => {
				this.navigatePreview()
			})
		})
		.catch(error => {
			this.setState({
				boardError: error
			})
		})
	}

	checkBoardIDAndLoad(input) {
		input = input.trim()
		if (input.length > 0) {
			this.loadBoard(input)
			return true
		}

		return false
	}

	onChangeBoardID({ target }) {
		this.checkBoardIDAndLoad(target.value)
	}
	
	onSetIFrame(iframe) {
		this.iframe = iframe
		this.navigatePreview()
	}

	htmlForPath(pathToFind) {
		const { routes } = this.state
		if (!routes) {
			return
		}

		pathToFind = conformPath(pathToFind)

		const matchingRoute = routes.find(({ path }) => (
			conformPath(path) === pathToFind
		))
		if (!matchingRoute) {
			return
		}

		let output = ''
		matchingRoute.handler({}, (html) => {
			output = html
		})

		return output
	}

	navigatePreview(path = this.state.initialPath) {
		const { iframe, state: { boardID } } = this

		if (!iframe || !boardID) {
			return
		}

		const { contentDocument } = this.iframe

		const html = this.htmlForPath(path) || ''
		renderPreviewHTMLToIFrame(html, iframe)

		navigatedTo({
			boardID,
			path
		})
	}

	render() {
		const { initialBoardID, boardError } = this.state

		return (
			<main>
				<header style={ headerStyle }>
					Trello Board ID:
					&nbsp;
					<input type="text" defaultValue={ initialBoardID } onChange={ this.onChangeBoardID } />
					{ boardError && <p style={ errorStyle }>Error loading: { boardError.message }</p> }
				</header>
				<div style={ iframeHolderStyle }>
					<iframe ref={ this.onSetIFrame } style={ iframeStyle } />
				</div>
			</main>
		)
	}
}