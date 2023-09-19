import { useQuery } from "react-query";
import Wrapper from "../components/Wrapper";
import Navbar from "../components/Navbar";
import { getAPI } from "../axios";
import { useNavigate } from "react-router-dom";

type Workspace = {
  Boards: Board[];
  workspaceId: number;
  workspaceName: string;
};

type Board = {
  boardId: number;
  boardName: string;
  Color?: {
    backgroundUrl?: string;
    colorId?: number;
    startColor?: string;
    endColor?: string;
  };
};

type SectionProps = {
  title: string;
  items: {
    id: number;
    name: string;
    workspaceId?: number;
    boardId?: number;
    boards?: Board[];
    color?: {
      backgroundUrl?: string;
      colorId?: number;
      startColor?: string;
      endColor?: string;
    };
  }[];
};

type MainCardProps = {
  name: string;
  workspaceId?: number;
  boardId?: number;
  color?: {
    backgroundUrl?: string;
    startColor?: string;
    endColor?: string;
  };
};

const fetchUserData = async () => {
  const response = await getAPI("/api/users");
  return response.data;
};

function Main() {
  const { data, isLoading, isError } = useQuery("userData", fetchUserData);

  const workspaces: Workspace[] = data || [];
  if (isLoading) return <p>로딩중..</p>;
  if (isError) return <p>서버 에러</p>;
  return (
    <Wrapper>
      <Navbar />
      <div className="flex w-full h-full overflow-auto justify-center items-center">
        <div className=" w-7/12 h-5/6 bg-[#1D2125] rounded-lg flex flex-col items-center overflow-auto">
          <h1 className="w-full h-16 py-2 border-b-2 border-white flex items-center text-white px-4 ">
            하이!
          </h1>
          <Section
            title="My Workspaces"
            items={workspaces.map((workspace: Workspace) => ({
              id: workspace.workspaceId,
              name: workspace.workspaceName,
              workspaceId: workspace.workspaceId,
              boards: workspace.Boards,
            }))}
          />
        </div>
      </div>
    </Wrapper>
  );
}

function Section({ title, items }: SectionProps) {
  return (
    <div className="w-full">
      <div className="w-full h-10 flex items-center p-4 text-white mt-2 text-2xl text-bold mb-2">
        {title}
      </div>
      {items?.map((item) => (
        <div className="w-full my-2">
          <div className="w-full flex items-center h-6 mb-2 mx-4 text-xl text-white">
            {item.name}
          </div>
          <div className="w-full h-full px-4 grid grid-cols-6 gap-x-6 gap-y-2 items-center text-sm">
            {item.boards?.map((board: Board) => (
              <MainCard
                key={board.boardId}
                name={board.boardName}
                workspaceId={item.workspaceId}
                boardId={board.boardId}
                color={board.Color}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MainCard({ name, workspaceId, boardId, color }: MainCardProps) {
  const navigate = useNavigate();
  const handleCardClick = () => {
    if (workspaceId && boardId) {
      navigate(`/workspaces/${workspaceId}/boards/${boardId}`);
    } else if (workspaceId) {
      navigate(`/workspaces/${workspaceId}/boards/1`);
    }
  };
  let backgroundStyle = {};
  if (color?.backgroundUrl) {
    if (color?.backgroundUrl) {
      backgroundStyle = {
        backgroundImage: `url(${color.backgroundUrl})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
      };
    }
  } else if (color?.startColor) {
    backgroundStyle = {
      backgroundImage: color.startColor,
    };
  } else if (color?.endColor) {
    backgroundStyle = {
      backgroundImage: color.endColor,
    };
  }

  return (
    <div onClick={handleCardClick}>
      <div style={backgroundStyle} className="w-20 h-12 rounded-md"></div>
      <div className="text-white mt-2 mx-1">{name}</div>
    </div>
  );
}

export default Main;

// const StyledDiv = styled.div`
//   background-image: ${(props) => props.gradient};
//   width: 100%;
//   height: 100%;
// `;
